import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { globSync } from 'tinyglobby'
import { BUILD_INPUT_DEFAULTS, type SubPackageManifest } from '../../packages/sdk/src/common/manifest.ts'
import {
  BUILD_CACHE_DIR,
  DIR_HASH_ALGORITHM,
  HASH_ALGORITHM,
  HEX,
  PARENT_DIR,
  PNPM,
  RESOURCE_KIND,
  UTF8,
} from './constants.ts'
import type { DiscoveredModule } from './discover.ts'
import { GenerateError } from './errors.ts'
import { PACKAGE_JSON } from './packages.ts'

export interface BuildStep {
  dir: string
  script: string
  manifest: SubPackageManifest
}

export type Runner = (cmd: string, args: string[], opts: { cwd: string }) => { status: number | null }

const IGNORE_NODE_MODULES = '**/node_modules/**'
/** Workspace deps are installed by `pnpm install`; skip pnpm's per-run verification (it would install in temp dirs). */
const PNPM_RUN_ARGS = ['--config.verify-deps-before-run=false', '--dir']

export const defaultRunner: Runner = (cmd, args, opts) => spawnSync(cmd, args, { cwd: opts.cwd, stdio: 'inherit' })

/** Builds ordered by module id; a module's sub-packages (sorted by dir) run before the module itself. */
export function planBuilds(mods: readonly DiscoveredModule[]): BuildStep[] {
  const steps: BuildStep[] = []
  for (const mod of [...mods].sort((a, b) => a.id.localeCompare(b.id))) {
    const subs = [...mod.subPackages].sort((a, b) => a.dir.localeCompare(b.dir))
    for (const sub of subs)
      if (sub.manifest.build) steps.push({ dir: sub.dir, script: sub.manifest.build, manifest: sub.manifest })
    if (mod.manifest.build) steps.push({ dir: mod.dir, script: mod.manifest.build, manifest: mod.manifest })
  }
  return steps
}

const scriptText = (dir: string, script: string): string =>
  (JSON.parse(readFileSync(join(dir, PACKAGE_JSON), UTF8)) as { scripts?: Record<string, string> }).scripts?.[script] ??
  ''

/** SHA-256 over the script name and text plus every `buildInputs` file (path and content). */
export function buildKey(dir: string, step: Pick<BuildStep, 'script' | 'manifest'>): string {
  const hash = createHash(HASH_ALGORITHM)
  hash.update(step.script).update('\0').update(scriptText(dir, step.script)).update('\0')
  const inputs = step.manifest.buildInputs ?? [...BUILD_INPUT_DEFAULTS]
  const files = globSync(inputs, { cwd: dir, ignore: [IGNORE_NODE_MODULES], onlyFiles: true }).sort()
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(join(dir, file)))
      .update('\0')
  return hash.digest(HEX)
}

const cacheFile = (repoRoot: string, dir: string): string =>
  join(repoRoot, BUILD_CACHE_DIR, `${createHash(DIR_HASH_ALGORITHM).update(relative(repoRoot, dir)).digest(HEX)}.json`)

function readCachedKey(file: string): string | undefined {
  if (!existsSync(file)) return undefined
  try {
    return (JSON.parse(readFileSync(file, UTF8)) as { key?: string }).key
  } catch {
    return undefined
  }
}

const outputsPresent = (dir: string, outputs: string[] | undefined): boolean =>
  !outputs || globSync(outputs, { cwd: dir, ignore: [IGNORE_NODE_MODULES], onlyFiles: false }).length > 0

/** Runs `pnpm --dir <dir> run <script>` for each step, skipping steps whose inputs did not change. */
export function runBuilds(
  plan: readonly BuildStep[],
  opts: { repoRoot: string; run?: Runner; force?: boolean },
): { ran: string[]; skipped: string[] } {
  const run = opts.run ?? defaultRunner
  const ran: string[] = []
  const skipped: string[] = []
  for (const step of plan) {
    const key = buildKey(step.dir, step)
    const cache = cacheFile(opts.repoRoot, step.dir)
    if (!opts.force && readCachedKey(cache) === key && outputsPresent(step.dir, step.manifest.buildOutputs)) {
      skipped.push(step.dir)
      continue
    }
    const result = run(PNPM, [...PNPM_RUN_ARGS, step.dir, 'run', step.script], { cwd: opts.repoRoot })
    if (result.status !== 0)
      throw new GenerateError([`build failed: ${relative(opts.repoRoot, step.dir)} (${step.script})`])
    mkdirSync(join(opts.repoRoot, BUILD_CACHE_DIR), { recursive: true })
    writeFileSync(cache, JSON.stringify({ key, finishedAt: Date.now() }))
    ran.push(step.dir)
  }
  return { ran, skipped }
}

export interface CollectedResource {
  module: string
  /** Absolute source path, resolved against the declaring package or sub-package dir (§10.4). */
  from: string
  /** `modules/<id>/<to>`, relative to the packaged resources root. */
  to: string
  kind: 'file' | 'dir'
  /** The module-relative `to` as declared (what `ctx.paths.resource` receives). */
  moduleTo: string
}

const escapes = (rel: string): boolean => isAbsolute(rel) || normalize(rel).split(sep)[0] === PARENT_DIR

function collectFrom(
  module: string,
  baseDir: string,
  entries: { from: string; to: string }[],
  out: CollectedResource[],
  problems: string[],
): void {
  for (const entry of entries) {
    const from = resolve(baseDir, entry.from)
    if (escapes(relative(baseDir, from)) || escapes(entry.to)) {
      problems.push(`${module}: extraResources ${entry.from} → ${entry.to} escapes its package`)
      continue
    }
    if (!existsSync(from)) {
      problems.push(`${module}: extraResources source ${relative(baseDir, from)} is missing after builds`)
      continue
    }
    const to = normalize(entry.to)
    out.push({
      module,
      from,
      to: `modules/${module}/${to}`,
      kind: statSync(from).isDirectory() ? RESOURCE_KIND.dir : RESOURCE_KIND.file,
      moduleTo: to,
    })
  }
}

/** Every `pragma.package.extraResources` of the modules and their sub-packages (sub-packages belong to the module). */
export function collectExtraResources(mods: readonly DiscoveredModule[]): {
  resources: CollectedResource[]
  problems: string[]
} {
  const resources: CollectedResource[] = []
  const problems: string[] = []
  for (const mod of mods) {
    collectFrom(mod.id, mod.dir, mod.manifest.package?.extraResources ?? [], resources, problems)
    for (const sub of mod.subPackages)
      collectFrom(mod.id, sub.dir, sub.manifest.package?.extraResources ?? [], resources, problems)
  }
  return { resources, problems }
}
