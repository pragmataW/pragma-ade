import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { z } from 'zod'
import {
  BUILD_RESOURCES_DIR,
  BUILDER_CONFIG_FILE,
  BUILDER_PLATFORM_KEYS,
  BUILDER_SCRATCH_FILES,
  CSC_DISCOVERY_ENV,
  ICON_FIELD,
  LEGAL_FILES,
  NATIVE_EXT,
  NODE_MODULES,
  TRANSIENT_NETWORK_ERROR,
  UTF8,
} from '../constants.ts'
import { loadElectronBuilder, loadYaml } from './deps.ts'
import type { Target } from './targets.ts'

export type BuilderConfig = Record<string, unknown>
const BuilderConfigSchema = z.record(z.string(), z.unknown())

export interface BuilderContext {
  repoRoot: string
  target: Target
  appDir: string
  resourcesDir: string
  outputDir: string
  electronVersion: string
  nativePackageNames: readonly string[]
}

const BUILDER_PLATFORM_ENUM = { mac: 'MAC', linux: 'LINUX', win: 'WINDOWS' } as const
const DISABLED = 'false'

/** `electron-builder.yml` as a plain object. */
export function loadBaseConfig(repoRoot: string): BuilderConfig {
  return BuilderConfigSchema.parse(loadYaml().parse(readFileSync(join(repoRoot, BUILDER_CONFIG_FILE), UTF8)))
}

const isObject = (v: unknown): v is BuilderConfig => typeof v === 'object' && v !== null && !Array.isArray(v)
const hasEntries = (dir: string): boolean => existsSync(dir) && readdirSync(dir).length > 0

/** Platform `icon` paths made absolute against the repo (the projectDir is the staging dir). */
function absoluteIcons(config: BuilderConfig, repoRoot: string): BuilderConfig {
  const out: BuilderConfig = { ...config }
  for (const key of BUILDER_PLATFORM_KEYS) {
    const section = config[key]
    if (!isObject(section)) continue
    const icon = section[ICON_FIELD]
    out[key] =
      typeof icon === 'string' && !isAbsolute(icon) ? { ...section, [ICON_FIELD]: resolve(repoRoot, icon) } : section
  }
  return out
}

/** LICENSE and THIRD_PARTY_NOTICES.md from the repo root, copied next to the app's resources. */
function legalFiles(repoRoot: string): { from: string; to: string }[] {
  return LEGAL_FILES.map((name) => ({ from: join(repoRoot, name), to: name })).filter((f) => existsSync(f.from))
}

/** The base config plus the per-target fields only the tool knows. */
export function computeConfig(base: BuilderConfig, ctx: BuilderContext): BuilderConfig {
  const config: BuilderConfig = {
    ...absoluteIcons(structuredClone(base), ctx.repoRoot),
    directories: {
      app: ctx.appDir,
      output: ctx.outputDir,
      buildResources: join(ctx.repoRoot, BUILD_RESOURCES_DIR),
    },
    electronVersion: ctx.electronVersion,
    asarUnpack: [`**/*${NATIVE_EXT}`, ...ctx.nativePackageNames.map((n) => `${NODE_MODULES}/${n}/**`)],
  }
  const extraResources = [
    ...(hasEntries(ctx.resourcesDir) ? [{ from: ctx.resourcesDir, to: '.', filter: ['**/*'] }] : []),
    ...legalFiles(ctx.repoRoot),
  ]
  if (extraResources.length > 0) config.extraResources = extraResources
  return config
}

/** Removes electron-builder's unpacked app dirs and debug files from the output dir; keeps the artifacts. */
function cleanOutput(outputDir: string): void {
  for (const name of readdirSync(outputDir)) {
    const path = join(outputDir, name)
    if (statSync(path).isDirectory() || (BUILDER_SCRATCH_FILES as readonly string[]).includes(name))
      rmSync(path, { recursive: true, force: true })
  }
}

/** Runs electron-builder's JS API for one target; returns the artifact paths left in the output dir. */
export async function runElectronBuilder(config: BuilderConfig, ctx: BuilderContext): Promise<string[]> {
  process.env[CSC_DISCOVERY_ENV] = DISABLED
  const builder = await loadElectronBuilder()
  const platform = builder.Platform[BUILDER_PLATFORM_ENUM[ctx.target.builderPlatform]]
  const build = () =>
    builder.build({
      projectDir: ctx.appDir,
      config,
      publish: 'never',
      targets: platform.createTarget(ctx.target.builderTargets, builder.Arch[ctx.target.arch]),
    })
  await build().catch((error: unknown) => {
    if (!TRANSIENT_NETWORK_ERROR.test(String(error))) throw error
    console.warn(`packaging: electron-builder hit a network error, retrying once: ${String(error)}`)
    return build()
  })
  cleanOutput(ctx.outputDir)
  return readdirSync(ctx.outputDir)
    .map((n) => join(ctx.outputDir, n))
    .sort()
}
