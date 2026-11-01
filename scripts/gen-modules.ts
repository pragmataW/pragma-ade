import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectExtraResources, planBuilds, type Runner, runBuilds } from './lib/builds.ts'
import {
  CLI_ARGS_START,
  GENERATED_DIR,
  JSON_INDENT,
  MAIN_REGISTRY_FILE,
  PARENT_DIR,
  PROVIDER_KIND,
  RENDERER_REGISTRY_FILE,
  RESOURCES_FILE,
  UTF8,
} from './lib/constants.ts'
import { type DiscoveredModule, discoverModulesWithWarnings } from './lib/discover.ts'
import { GenerateError } from './lib/errors.ts'
import { moduleLocales, readCoreLocales, renderMainRegistry, renderRendererRegistry } from './lib/render.ts'

export interface GenerateOptions {
  repoRoot: string
  roots?: readonly string[]
  outDir?: string
  includeUnderscored?: boolean
  /** Run `pragma.build` hooks (default true). */
  build?: boolean
  forceBuild?: boolean
  run?: Runner
}

export interface GenerateResult {
  modules: DiscoveredModule[]
  written: string[]
  warnings: string[]
  builds: { ran: string[]; skipped: string[] }
}

function writeIfChanged(file: string, content: string, written: string[]): void {
  if (existsSync(file) && readFileSync(file, UTF8) === content) return
  writeFileSync(file, content)
  written.push(file)
}

/** Discovers modules, runs build hooks and writes the gitignored registry files (§2.3, §10.2). */
export function generateRegistry(opts: GenerateOptions): GenerateResult {
  const repoRoot = resolve(opts.repoRoot)
  const outDir = opts.outDir ?? join(repoRoot, GENERATED_DIR)
  const { modules, warnings } = discoverModulesWithWarnings({
    repoRoot,
    roots: opts.roots,
    includeUnderscored: opts.includeUnderscored,
  })
  const localeProblems = modules.flatMap((m) => moduleLocales(m).problems)
  if (localeProblems.length > 0) throw new GenerateError(localeProblems)
  const builds =
    opts.build === false
      ? { ran: [], skipped: [] }
      : runBuilds(planBuilds(modules), { repoRoot, run: opts.run, force: opts.forceBuild })
  const { resources, problems } = collectExtraResources(modules)
  if (problems.length > 0) throw new GenerateError(problems)
  const ctx = { outDir, coreLocales: readCoreLocales(repoRoot), resources }
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  writeIfChanged(join(outDir, MAIN_REGISTRY_FILE), renderMainRegistry(modules, ctx), written)
  writeIfChanged(join(outDir, RENDERER_REGISTRY_FILE), renderRendererRegistry(modules, ctx), written)
  const resourceList = resources.map(({ module, from, to, kind }) => ({ module, from, to, kind }))
  writeIfChanged(join(outDir, RESOURCES_FILE), `${JSON.stringify(resourceList, null, JSON_INDENT)}\n`, written)
  return { modules, written, warnings, builds }
}

function main(argv: string[]): void {
  const repoRoot = resolve(import.meta.dirname, PARENT_DIR)
  try {
    const result = generateRegistry({
      repoRoot,
      build: !argv.includes('--no-build'),
      forceBuild: argv.includes('--force-build'),
    })
    for (const w of result.warnings) console.warn(`  ! ${w}`)
    const providers = result.modules.filter((m) => m.manifest.kind === PROVIDER_KIND).length
    const { ran, skipped } = result.builds
    console.log(
      `gen-modules: ${result.modules.length - providers} modules, ${providers} providers, ${ran.length + skipped.length} builds (${skipped.length} cached) → ${relative(repoRoot, join(repoRoot, GENERATED_DIR))}`,
    )
  } catch (error) {
    if (!(error instanceof GenerateError)) throw error
    for (const p of error.problems) console.error(`  ✗ ${p}`)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(CLI_ARGS_START))
