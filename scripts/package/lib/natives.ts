import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import {
  BUILD_DIR,
  CACHE_KEY_SCOPE_SEP,
  DARWIN,
  ELECTRON_HEADERS_URL,
  LINUX,
  LIST_SEP,
  NATIVE_COMPILE_TIMEOUT_MS,
  NATIVE_EXT,
  NATIVE_MARKERS,
  NATIVES_DIR,
  NODE,
  NODE_GYP_SCRIPT,
  NODE_MODULES,
  PARENT_SEGMENT,
  POSIX_SEP,
  RELEASE_DIR,
  WIN32,
} from '../constants.ts'
import { detectBinaryFile, matchesTarget } from './binary-arch.ts'
import { dockerCompileNative, ensureDocker } from './docker.ts'
import { run } from './exec.ts'
import { cacheRoot, walkFiles } from './fsx.ts'
import { packageDirs, readPackageMeta } from './packages.ts'
import type { NativeResolution } from './schema.ts'
import type { Target } from './targets.ts'

export interface NativePackage {
  name: string
  version: string
  dir: string
  /** `.node` files built for the target. */
  matching: string[]
  /** `.node` files for other platforms or arches. */
  foreign: string[]
  optionalDeps: string[]
}

export { NATIVE_SOURCES, type NativeResolution } from './schema.ts'

export interface NativeOptions {
  electronVersion: string
  dockerAutoStart: boolean
}

export class NativeUnavailableError extends Error {}

const TOOL_DIR = join(import.meta.dirname, PARENT_SEGMENT)

const isNativeFile = (f: string): boolean => f.endsWith(NATIVE_EXT)

async function nativePackageAt(dir: string, target: Target): Promise<NativePackage | null> {
  const files = walkFiles(dir, { skipDirs: [NODE_MODULES] }).filter(isNativeFile)
  const marked = NATIVE_MARKERS.some((m) => existsSync(join(dir, m)))
  if (!marked && files.length === 0) return null
  const meta = readPackageMeta(dir)
  const matching: string[] = []
  const foreign: string[] = []
  for (const f of files) {
    const info = await detectBinaryFile(f)
    if (info && matchesTarget(info, target)) matching.push(f)
    else foreign.push(f)
  }
  return {
    name: meta?.name ?? basename(dir),
    version: meta?.version ?? '',
    dir,
    matching,
    foreign,
    optionalDeps: Object.keys(meta?.optionalDependencies ?? {}),
  }
}

/**
 * Packages under `<rootDir>/node_modules` with compiled code (binding.gyp, prebuilds/ or any `.node`), plus loaders
 * whose optional dependencies are such packages (`@parcel/watcher` → `@parcel/watcher-<platform>`).
 */
export async function findNativePackages(rootDir: string, target: Target): Promise<NativePackage[]> {
  const dirs = packageDirs(join(rootDir, NODE_MODULES))
  const out: NativePackage[] = []
  for (const dir of dirs) {
    const p = await nativePackageAt(dir, target)
    if (p) out.push(p)
  }
  const native = new Set(out.map((p) => p.name))
  for (const dir of dirs) {
    const meta = readPackageMeta(dir)
    const optionalDeps = Object.keys(meta?.optionalDependencies ?? {})
    if (!meta?.name || native.has(meta.name) || !optionalDeps.some((d) => native.has(d))) continue
    out.push({ name: meta.name, version: meta.version ?? '', dir, matching: [], foreign: [], optionalDeps })
  }
  return out
}

/** Its own target `.node`, or an installed optional dependency (per-platform package) that has one. */
export function isSatisfied(p: NativePackage, all: readonly NativePackage[]): boolean {
  if (p.matching.length > 0) return true
  return p.optionalDeps.some((d) => all.some((x) => x.name === d && x.matching.length > 0))
}

export const nativeCacheKey = (name: string, version: string, target: Target, electronVersion: string): string =>
  `${name.replace(POSIX_SEP, CACHE_KEY_SCOPE_SEP)}@${version}-${target.id}-electron${electronVersion}`

const cacheDirOf = (p: NativePackage, target: Target, ev: string): string =>
  join(cacheRoot(), NATIVES_DIR, nativeCacheKey(p.name, p.version, target, ev))
const releaseDir = (pkgDir: string): string => join(pkgDir, BUILD_DIR, RELEASE_DIR)

const nativeFilesIn = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter(isNativeFile)
        .map((f) => join(dir, f))
    : []

/** Replaces the package's `build/` with just `build/Release/*.node` from `fromDir`. */
function installNatives(fromDir: string, pkgDir: string): string[] {
  const files = nativeFilesIn(fromDir)
  const keep = files.map((f) => ({ name: basename(f), from: f }))
  rmSync(join(pkgDir, BUILD_DIR), { recursive: true, force: true })
  mkdirSync(releaseDir(pkgDir), { recursive: true })
  return keep.map(({ name, from }) => {
    const dest = join(releaseDir(pkgDir), name)
    copyFileSync(from, dest)
    return dest
  })
}

function saveToCache(files: readonly string[], cacheDir: string): void {
  mkdirSync(cacheDir, { recursive: true })
  for (const f of files) copyFileSync(f, join(cacheDir, basename(f)))
}

function unavailable(p: NativePackage, target: Target, cacheDir: string, why: string): NativeUnavailableError {
  return new NativeUnavailableError(
    `${p.name}@${p.version} has no ${target.id} prebuilt; ${why}; place the .node files built for ${target.id} in ${cacheDir} or use a version that ships ${target.id} prebuilds`,
  )
}

async function compile(
  p: NativePackage,
  rootDir: string,
  target: Target,
  o: NativeOptions,
  cacheDir: string,
): Promise<Pick<NativeResolution, 'source' | 'glibcMax'>> {
  switch (target.platform) {
    case DARWIN: {
      const args = [
        join(TOOL_DIR, NODE_GYP_SCRIPT),
        'rebuild',
        '--release',
        `--arch=${target.arch}`,
        `--target=${o.electronVersion}`,
        `--dist-url=${ELECTRON_HEADERS_URL}`,
      ]
      await run(NODE, args, { cwd: p.dir, timeoutMs: NATIVE_COMPILE_TIMEOUT_MS })
      return { source: 'host-compile' }
    }
    case LINUX: {
      const docker = await ensureDocker({ autoStart: o.dockerAutoStart })
      if (!docker.ok) throw unavailable(p, target, cacheDir, `Linux compile needs Docker (${docker.reason})`)
      const rel = relative(rootDir, p.dir).split('\\').join(POSIX_SEP)
      const { glibcMax } = await dockerCompileNative(rootDir, rel, o.electronVersion)
      return { source: 'docker-compile', glibcMax }
    }
    case WIN32:
      throw unavailable(p, target, cacheDir, 'Windows native code cannot be compiled on macOS')
    default: {
      const never: never = target.platform
      throw new Error(`unknown platform ${String(never)}`)
    }
  }
}

async function resolveOne(
  p: NativePackage,
  rootDir: string,
  target: Target,
  o: NativeOptions,
): Promise<NativeResolution> {
  const cacheDir = cacheDirOf(p, target, o.electronVersion)
  const base = { name: p.name, version: p.version }
  if (nativeFilesIn(cacheDir).length > 0) return { ...base, source: 'cache', files: installNatives(cacheDir, p.dir) }
  const built = await compile(p, rootDir, target, o, cacheDir)
  const produced = nativeFilesIn(releaseDir(p.dir))
  if (produced.length === 0) throw unavailable(p, target, cacheDir, 'the compile produced no .node file')
  saveToCache(produced, cacheDir)
  return { ...base, ...built, files: installNatives(cacheDir, p.dir) }
}

/** Every native package under `<rootDir>/node_modules` gets a target binary: prebuilt, cached or compiled. */
export async function ensureNatives(rootDir: string, target: Target, o: NativeOptions): Promise<NativeResolution[]> {
  const all = await findNativePackages(rootDir, target)
  const out: NativeResolution[] = []
  for (const p of all) {
    if (isSatisfied(p, all)) {
      out.push({ name: p.name, version: p.version, source: 'prebuilt', files: p.matching })
      continue
    }
    out.push(await resolveOne(p, rootDir, target, o))
  }
  const after = await findNativePackages(rootDir, target)
  const missing = after.filter((p) => !isSatisfied(p, after)).map((p) => p.name)
  if (missing.length > 0) throw new NativeUnavailableError(`no ${target.id} binary for: ${missing.join(LIST_SEP)}`)
  return out
}
