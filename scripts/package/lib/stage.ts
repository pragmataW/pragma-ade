import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import {
  ARCH_JOINER,
  BUNDLE_OUT_DIR,
  EXEC_MODE,
  JSON_INDENT,
  NATIVE_EXT,
  NODE_MODULES,
  NPM,
  NPM_INSTALL_ARGS,
  NPM_INSTALL_TIMEOUT_MS,
  NPM_LOCK_ONLY_ARGS,
  PACKAGE_JSON,
  PACKAGE_LOCK,
  PLATFORM_ARCH_SEP,
  PREBUILDS_DIR,
  PRUNE_RULES,
  RENDERER_DIR,
  RESOURCE_PACKAGE_SUFFIX,
  RESOURCE_PACKAGE_VERSION,
  SCOPE_PREFIX,
  SPAWN_HELPER,
  STAGE_APP_DIR,
  STAGE_DIR,
  STAGE_RESOURCES_DIR,
  STAGED_APP_NAME,
  UTF8,
  WIN32,
} from '../constants.ts'
import { detectBinaryFile } from './binary-arch.ts'
import { run } from './exec.ts'
import {
  analyzeBundle,
  analyzeFiles,
  assertNoWorkspaceExternals,
  type ExternalRef,
  type ExternalScan,
  packageRootOf,
} from './externals.ts'
import { cacheRoot, copyDir, expandStars, isDir, walkFiles } from './fsx.ts'
import { ModuleTypeSchema, type PackageJson } from './schema.ts'
import type { Target } from './targets.ts'
import type { ResourceDecl } from './workspace.ts'

export interface StageInput {
  target: Target
  desktopDir: string
  desktopPkg: PackageJson
  productName: string
  resources: readonly ResourceDecl[]
  searchDirs: readonly string[]
}

export interface StagedResource {
  dest: string
  /** Absolute staged path (a dir, or the dir holding a file resource). */
  dir: string
  declaredBy: string
  externals: ExternalRef[]
}

export interface StageResult {
  stageRoot: string
  appDir: string
  resourcesDir: string
  externals: ExternalRef[]
  resources: StagedResource[]
  pruned: string[]
  chmodded: string[]
  warnings: string[]
}

export type StagedPackageMeta = Pick<PackageJson, 'name' | 'version' | 'type' | 'main'> & {
  productName?: string
  description?: string
  author?: { name: string }
}

export class StageError extends Error {}

const DEFAULT_DESCRIPTION = 'Pragma ADE'

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, JSON_INDENT)}\n`)

/** Writes `package.json` with exact dependency pins and installs them for the target platform (npm `--os/--cpu`). */
export async function npmInstallForTarget(
  dir: string,
  deps: readonly ExternalRef[],
  target: Target,
  meta: StagedPackageMeta,
): Promise<void> {
  const dependencies = Object.fromEntries(deps.map((d) => [d.name, d.version]))
  writeJson(join(dir, PACKAGE_JSON), { ...meta, private: true, dependencies })
  if (deps.length === 0) {
    await run(NPM, NPM_LOCK_ONLY_ARGS, { cwd: dir, timeoutMs: NPM_INSTALL_TIMEOUT_MS })
    return
  }
  const platform = [`--os=${target.npm.os}`, `--cpu=${target.npm.cpu}`]
  if (target.npm.libc) platform.push(`--libc=${target.npm.libc}`)
  await run(NPM, [...NPM_INSTALL_ARGS, ...platform], { cwd: dir, timeoutMs: NPM_INSTALL_TIMEOUT_MS })
}

const quoted = (s: string): string[] => [`"${s}"`, `'${s}'`]

/** Replaces each quoted specifier (exact `'spec'` / `"spec"` only) in the staged copy of its file. */
export function applyRewrites(rewrites: ExternalScan['rewrites'], fromRoot: string, toRoot: string): void {
  const byFile = new Map<string, ExternalScan['rewrites']>()
  for (const r of rewrites) byFile.set(r.file, [...(byFile.get(r.file) ?? []), r])
  for (const [file, list] of byFile) {
    const staged = join(toRoot, relative(fromRoot, file))
    let text = readFileSync(staged, UTF8)
    for (const r of list) {
      const [dq, sq] = quoted(r.to)
      const [fromDq = '', fromSq = ''] = quoted(r.from)
      text = text.replaceAll(fromDq, dq ?? '').replaceAll(fromSq, sq ?? '')
    }
    writeFileSync(staged, text)
  }
}

/** Every installed package dir below a node_modules dir (scoped and nested ones included). */
function packageDirs(nodeModulesDir: string): string[] {
  if (!existsSync(nodeModulesDir)) return []
  const out: string[] = []
  for (const name of readdirSync(nodeModulesDir)) {
    const path = join(nodeModulesDir, name)
    if (!isDir(path)) continue
    const dirs = name.startsWith(SCOPE_PREFIX) ? readdirSync(path).map((n) => join(path, n)) : [path]
    for (const dir of dirs.filter(isDir)) out.push(dir, ...packageDirs(join(dir, NODE_MODULES)))
  }
  return out
}

/** `darwin-x64+arm64` / `linux-x64.node` → platform and arches; null for other names. */
function parsePrebuildName(entry: string): { platform: string; arches: string[] } | null {
  const name = entry.endsWith(NATIVE_EXT) ? entry.slice(0, -NATIVE_EXT.length) : entry
  const at = name.indexOf(PLATFORM_ARCH_SEP)
  if (at <= 0) return null
  return { platform: name.slice(0, at), arches: name.slice(at + 1).split(ARCH_JOINER) }
}

function prunePrebuilds(pkgDir: string, target: Target): string[] {
  const dir = join(pkgDir, PREBUILDS_DIR)
  if (!isDir(dir)) return []
  const removed: string[] = []
  for (const entry of readdirSync(dir)) {
    const parsed = parsePrebuildName(entry)
    if (parsed && parsed.platform === target.platform && parsed.arches.includes(target.arch)) continue
    rmSync(join(dir, entry), { recursive: true, force: true })
    removed.push(join(dir, entry))
  }
  return removed
}

function applyPruneRules(pkgDir: string, target: Target): string[] {
  const name = pkgName(pkgDir)
  const rule = PRUNE_RULES.find((r) => r.package === name)
  if (!rule) return []
  const removed = rule.remove(target).flatMap((pattern) => expandStars(pkgDir, pattern))
  for (const rel of removed) rmSync(join(pkgDir, rel), { recursive: true, force: true })
  return removed.map((rel) => join(pkgDir, rel))
}

function pkgName(pkgDir: string): string | undefined {
  const file = join(pkgDir, PACKAGE_JSON)
  if (!existsSync(file)) return undefined
  const name: unknown = JSON.parse(readFileSync(file, UTF8)).name
  return typeof name === 'string' ? name : undefined
}

/** Removes other platforms' prebuilds and payloads (`PRUNE_RULES`); returns the removed paths. */
export function pruneForTarget(nodeModulesDir: string, target: Target): string[] {
  return packageDirs(nodeModulesDir).flatMap((dir) => [...prunePrebuilds(dir, target), ...applyPruneRules(dir, target)])
}

/** node-pty ships `spawn-helper` as 0644: helpers and executable binaries get 0755 (not on win32). */
export async function fixExecutableBits(dir: string, target: Target): Promise<string[]> {
  if (target.platform === WIN32 || !existsSync(dir)) return []
  const changed: string[] = []
  for (const file of walkFiles(dir)) {
    const exec = basename(file) === SPAWN_HELPER || (await detectBinaryFile(file))?.executable === true
    if (!exec) continue
    chmodSync(file, EXEC_MODE)
    changed.push(file)
  }
  return changed
}

function nearestType(path: string): PackageJson['type'] {
  const root = packageRootOf(join(path, PACKAGE_JSON))
  if (!root) return undefined
  const type: unknown = JSON.parse(readFileSync(join(root, PACKAGE_JSON), UTF8)).type
  const parsed = ModuleTypeSchema.safeParse(type)
  return parsed.success ? parsed.data : undefined
}

async function stageResource(
  decl: ResourceDecl,
  resourcesDir: string,
  input: StageInput,
  warnings: string[],
): Promise<StagedResource> {
  if (!existsSync(decl.fromAbs))
    throw new StageError(
      `${decl.declaredBy}: extraResources from "${relative(decl.declaredBy, decl.fromAbs)}" not found — did pragma.build run?`,
    )
  const destPath = join(resourcesDir, decl.dest)
  const isFile = statSync(decl.fromAbs).isFile()
  mkdirSync(dirname(destPath), { recursive: true })
  if (isFile) copyFileSync(decl.fromAbs, destPath)
  else copyDir(decl.fromAbs, destPath)
  const sourceRoot = isFile ? dirname(decl.fromAbs) : decl.fromAbs
  const dir = isFile ? dirname(destPath) : destPath
  const searchDirs = [
    decl.declaredBy,
    packageRootOf(decl.fromAbs) ?? decl.declaredBy,
    input.desktopDir,
    ...input.searchDirs,
  ]
  const scan = isFile ? analyzeFiles(sourceRoot, [decl.fromAbs], searchDirs) : analyzeBundle(sourceRoot, searchDirs)
  assertNoWorkspaceExternals(scan)
  applyRewrites(scan.rewrites, sourceRoot, dir)
  warnings.push(...scan.unresolved.map((u) => `${decl.dest}: unresolved import "${u}"`))
  if (scan.externals.length > 0) {
    const meta = {
      name: `${decl.ownerId}${RESOURCE_PACKAGE_SUFFIX}`,
      version: RESOURCE_PACKAGE_VERSION,
      type: nearestType(decl.fromAbs),
    }
    await npmInstallForTarget(dir, scan.externals, input.target, meta)
    rmSync(join(dir, PACKAGE_LOCK), { force: true })
  }
  return { dest: decl.dest, dir, declaredBy: decl.declaredBy, externals: scan.externals }
}

async function stageApp(input: StageInput, appDir: string, warnings: string[]): Promise<ExternalRef[]> {
  const out = join(input.desktopDir, BUNDLE_OUT_DIR)
  copyDir(out, join(appDir, BUNDLE_OUT_DIR))
  const scan = analyzeBundle(out, [input.desktopDir, ...input.searchDirs], { skipDirs: [RENDERER_DIR] })
  assertNoWorkspaceExternals(scan)
  applyRewrites(scan.rewrites, out, join(appDir, BUNDLE_OUT_DIR))
  warnings.push(...scan.unresolved.map((u) => `app: unresolved import "${u}"`))
  const { version, type, main } = input.desktopPkg
  await npmInstallForTarget(appDir, scan.externals, input.target, {
    name: STAGED_APP_NAME,
    productName: input.productName,
    version,
    description: DEFAULT_DESCRIPTION,
    author: { name: input.productName },
    main,
    type,
  })
  return scan.externals
}

/** A clean per-target staging dir: the app (out/ + target node_modules) and every declared resource. */
export async function stageTarget(input: StageInput): Promise<StageResult> {
  const stageRoot = join(cacheRoot(), STAGE_DIR, input.target.id)
  rmSync(stageRoot, { recursive: true, force: true })
  const appDir = join(stageRoot, STAGE_APP_DIR)
  const resourcesDir = join(stageRoot, STAGE_RESOURCES_DIR)
  mkdirSync(appDir, { recursive: true })
  mkdirSync(resourcesDir, { recursive: true })
  const warnings: string[] = []
  const externals = await stageApp(input, appDir, warnings)
  const resources: StagedResource[] = []
  for (const decl of input.resources) resources.push(await stageResource(decl, resourcesDir, input, warnings))
  const pruned = [
    ...pruneForTarget(join(appDir, NODE_MODULES), input.target),
    ...resources.flatMap((r) => pruneForTarget(join(r.dir, NODE_MODULES), input.target)),
  ]
  const chmodded = [
    ...(await fixExecutableBits(appDir, input.target)),
    ...(await fixExecutableBits(resourcesDir, input.target)),
  ]
  return { stageRoot, appDir, resourcesDir, externals, resources, pruned, chmodded, warnings }
}
