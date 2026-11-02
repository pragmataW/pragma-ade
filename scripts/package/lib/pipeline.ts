import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILD_SCRIPT,
  DESKTOP_DIR,
  DIST_DIR,
  ELECTRON_PACKAGE,
  GIT,
  LIST_SEP,
  MANIFEST_FILE,
  NODE_MODULES,
  PACKAGE_JSON,
  PARENT_SEGMENT,
  PNPM,
  RUN_SUBCOMMAND,
  SEVERITY,
  STATUS,
  TOOL_DEP_MARKER,
  UTF8,
} from '../constants.ts'
import { auditTarget } from './audit.ts'
import { computeConfig, loadBaseConfig, runElectronBuilder } from './builder.ts'
import { doctor } from './doctor.ts'
import { run } from './exec.ts'
import { readJson } from './fsx.ts'
import { ensureNatives, findNativePackages } from './natives.ts'
import { readManifest, writeManifest } from './report.ts'
import {
  type AuditExpectations,
  type DistManifest,
  type NativeResolution,
  type PackageJson,
  PackageJsonSchema,
  type TargetReport,
} from './schema.ts'
import { type StageResult, stageTarget } from './stage.ts'
import { TARGETS, type Target, type TargetId } from './targets.ts'
import { collectPackaging, listWorkspacePackages, type PackagingPlan } from './workspace.ts'

export interface BuildOptions {
  repoRoot: string
  targets: TargetId[]
  skipAppBuild: boolean
  dockerAutoStart: boolean
  keepStage: boolean
  deep: boolean
}

interface RepoFacts {
  desktopDir: string
  desktopPkg: PackageJson
  electronVersion: string
  productName: string
  executableName: string
  plan: PackagingPlan
  warnings: string[]
}

const versionOf = (dir: string): string =>
  (JSON.parse(readFileSync(join(dir, PACKAGE_JSON), UTF8)) as { version?: string }).version ?? ''

const log = (line: string): void => console.log(`packaging: ${line}`)

function repoFacts(repoRoot: string): RepoFacts {
  const warnings: string[] = []
  const plan = collectPackaging(listWorkspacePackages(repoRoot, warnings))
  const desktopDir = join(repoRoot, DESKTOP_DIR)
  const base = loadBaseConfig(repoRoot)
  const linux = base.linux as { executableName?: string } | undefined
  return {
    desktopDir,
    desktopPkg: readJson(join(desktopDir, PACKAGE_JSON), PackageJsonSchema),
    electronVersion: versionOf(join(desktopDir, NODE_MODULES, ELECTRON_PACKAGE)),
    productName: String(base.productName),
    executableName: linux?.executableName ?? String(base.productName),
    plan,
    warnings: [...warnings, ...plan.unpackagedBuilds.map((b) => `${b.packageName}: built but not packaged`)],
  }
}

async function resolveNatives(stage: StageResult, target: Target, o: BuildOptions, ev: string) {
  const opts = { electronVersion: ev, dockerAutoStart: o.dockerAutoStart }
  const natives: NativeResolution[] = await ensureNatives(stage.appDir, target, opts)
  for (const r of stage.resources)
    if (r.externals.length > 0) natives.push(...(await ensureNatives(r.dir, target, opts)))
  return natives
}

async function expectedNatives(stage: StageResult, target: Target): Promise<{ app: string[]; all: string[] }> {
  const app = (await findNativePackages(stage.appDir, target)).map((p) => p.name)
  const res: string[] = []
  for (const r of stage.resources) res.push(...(await findNativePackages(r.dir, target)).map((p) => p.name))
  return { app, all: [...new Set([...app, ...res])] }
}

async function buildOne(id: TargetId, o: BuildOptions, facts: RepoFacts): Promise<TargetReport> {
  const target = TARGETS[id]
  const outputDir = join(o.repoRoot, DIST_DIR, id)
  rmSync(outputDir, { recursive: true, force: true })
  log(`${id}: staging`)
  const stage = await stageTarget({
    target,
    desktopDir: facts.desktopDir,
    desktopPkg: facts.desktopPkg,
    productName: facts.productName,
    resources: facts.plan.resources,
    searchDirs: [],
  })
  try {
    const natives = await resolveNatives(stage, target, o, facts.electronVersion)
    const names = await expectedNatives(stage, target)
    const ctx = {
      repoRoot: o.repoRoot,
      target,
      appDir: stage.appDir,
      resourcesDir: stage.resourcesDir,
      outputDir,
      electronVersion: facts.electronVersion,
      nativePackageNames: names.app,
    }
    log(`${id}: electron-builder ${target.builderTargets.join(LIST_SEP)}`)
    const artifacts = await runElectronBuilder(computeConfig(loadBaseConfig(o.repoRoot), ctx), ctx)
    const expectations: AuditExpectations = {
      productName: facts.productName,
      executableName: facts.executableName,
      resourceDests: facts.plan.resources.map((r) => r.dest),
      nativePackages: names.all,
      main: facts.desktopPkg.main ?? '',
    }
    log(`${id}: audit${o.deep ? ' (deep)' : ''}`)
    const audit = await auditTarget(target, outputDir, expectations, { deep: o.deep })
    const failing = audit.checks.filter((c) => !c.ok && c.severity === SEVERITY.error).map((c) => c.id)
    return {
      status: audit.ok ? STATUS.ok : STATUS.failed,
      ...(audit.ok ? {} : { error: `audit failed: ${[...new Set(failing)].join(LIST_SEP)}` }),
      artifacts,
      externals: stage.externals,
      resources: stage.resources.map((r) => ({ dest: r.dest, declaredBy: r.declaredBy })),
      natives,
      warnings: stage.warnings,
      expectations,
      audit,
    }
  } finally {
    if (!o.keepStage) rmSync(stage.stageRoot, { recursive: true, force: true })
  }
}

const failedReport = (error: unknown): TargetReport => ({
  status: STATUS.failed,
  error: error instanceof Error ? error.message : String(error),
  artifacts: [],
  externals: [],
  resources: [],
  natives: [],
  warnings: [],
})

async function repoCommit(repoRoot: string): Promise<string | null> {
  const r = await run(GIT, ['rev-parse', 'HEAD'], { cwd: repoRoot, allowFail: true })
  return r.code === 0 ? r.stdout.trim() : null
}

/** doctor → `pnpm build` → per-target stage/natives/electron-builder/audit → dist/manifest.json + SUMMARY.md. */
export async function buildTargets(o: BuildOptions): Promise<DistManifest> {
  const host = await doctor({ repoRoot: o.repoRoot })
  if (!host.ok) throw new Error(`doctor failed: ${JSON.stringify(host)}`)
  if (!o.skipAppBuild) {
    log('pnpm build')
    await run(PNPM, [RUN_SUBCOMMAND, BUILD_SCRIPT], { cwd: o.repoRoot, onLine: (l) => console.log(`  ${l}`) })
  }
  const facts = repoFacts(o.repoRoot)
  const targets: DistManifest['targets'] = {}
  for (const id of o.targets) {
    targets[id] = await buildOne(id, o, facts).catch(failedReport)
    log(`${id}: ${targets[id]?.status}${targets[id]?.error ? ` — ${targets[id]?.error}` : ''}`)
  }
  return writeManifest(join(o.repoRoot, DIST_DIR), {
    generatedAt: new Date().toISOString(),
    repoCommit: await repoCommit(o.repoRoot),
    appVersion: facts.desktopPkg.version ?? '',
    electronVersion: facts.electronVersion,
    electronBuilderVersion: versionOf(join(import.meta.dirname, PARENT_SEGMENT, NODE_MODULES, TOOL_DEP_MARKER)),
    targets,
    unpackagedBuilds: facts.plan.unpackagedBuilds,
    warnings: facts.warnings,
  })
}

/** Re-audits `dist/<target>` against the expectations stored in dist/manifest.json. */
export async function auditTargets(repoRoot: string, ids: readonly TargetId[], deep: boolean): Promise<DistManifest> {
  const distDir = join(repoRoot, DIST_DIR)
  const manifest = readManifest(distDir)
  if (!manifest) throw new Error(`no ${join(distDir, MANIFEST_FILE)}; run build first`)
  const targets: DistManifest['targets'] = {}
  for (const id of ids) {
    const prev = manifest.targets[id]
    if (!prev?.expectations) {
      targets[id] = failedReport(new Error(`${id} was not built`))
      continue
    }
    const audit = await auditTarget(TARGETS[id], join(distDir, id), prev.expectations, { deep })
    targets[id] = { ...prev, status: audit.ok ? STATUS.ok : STATUS.failed, audit }
  }
  return writeManifest(distDir, { ...manifest, targets })
}
