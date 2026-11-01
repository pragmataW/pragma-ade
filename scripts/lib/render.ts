import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import type { CollectedResource } from './builds.ts'
import {
  AUTO_GENERATED_HEADER,
  CORE_LOCALES_DIR,
  REGISTRY_FIELDS as F,
  JSON_EXT,
  LIST_SEPARATOR,
  TS_UNDEFINED,
  UTF8,
} from './constants.ts'
import type { DiscoveredModule } from './discover.ts'
import { mergeLocaleFilesChecked } from './locales.ts'

const SOURCE_EXT = /\.tsx?$/
const RAW_SUFFIX = '?raw'
const INDENT = '  '

export type LocaleMap = Record<string, object>

export interface RenderContext {
  outDir: string
  coreLocales: LocaleMap
  resources: readonly CollectedResource[]
}

const toPosix = (p: string): string => p.split(sep).join('/')

function importPath(outDir: string, file: string, keepExtension = false): string {
  const rel = toPosix(relative(outDir, file))
  const path = rel.startsWith('.') ? rel : `./${rel}`
  return keepExtension ? path : path.replace(SOURCE_EXT, '')
}

const readJson = (file: string): object => JSON.parse(readFileSync(file, UTF8)) as object

/** Merged locales per language (provider capability files are merged into the provider namespace). */
export function moduleLocales(mod: DiscoveredModule): { locales: LocaleMap; problems: string[] } {
  const locales: LocaleMap = {}
  const problems: string[] = []
  for (const [lng, files] of Object.entries(mod.locales)) {
    const merged = mergeLocaleFilesChecked(files.map((file) => ({ file: basename(file), json: readJson(file) })))
    locales[lng] = merged.merged
    problems.push(...merged.problems.map((p) => `${mod.id}: ${p}`))
  }
  return { locales, problems }
}

export function readCoreLocales(repoRoot: string): LocaleMap {
  const dir = join(repoRoot, CORE_LOCALES_DIR)
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(JSON_EXT))
    .sort()
  return Object.fromEntries(files.map((f) => [basename(f, JSON_EXT), readJson(join(dir, f))]))
}

class ImportList {
  readonly lines: string[] = []
  add(name: string, path: string): string {
    this.lines.push(`import ${name} from '${path}'`)
    return name
  }
}

const json = (value: unknown): string => JSON.stringify(value)
const field = (key: string, value: string): string => `${INDENT}${INDENT}${key}: ${value},`

function mainRecord(mod: DiscoveredModule, i: number, ctx: RenderContext, imports: ImportList): string {
  const p = `m${i}`
  const main = mod.mainEntry ? imports.add(`${p}_main`, importPath(ctx.outDir, mod.mainEntry)) : TS_UNDEFINED
  const migrations = mod.migrations.map((file, j) => {
    const sql = imports.add(`${p}_sql${j}`, `${importPath(ctx.outDir, file, true)}${RAW_SUFFIX}`)
    return `{ name: ${json(basename(file))}, sql: ${sql} }`
  })
  const extra = ctx.resources.filter((r) => r.module === mod.id).map((r) => ({ from: r.from, to: r.moduleTo }))
  const lines = [
    field(F.manifest, json(mod.manifest)),
    field(F.packageName, json(mod.packageName)),
    field(F.version, json(mod.version)),
    field(F.dir, json(mod.dir)),
    field(F.extraResources, json(extra)),
    field(F.main, main),
    field(F.migrations, `[${migrations.join(LIST_SEPARATOR)}]`),
    field(F.locales, json(moduleLocales(mod).locales)),
  ]
  if (mod.testHooks) lines.push(field(F.testHooks, `() => import('${importPath(ctx.outDir, mod.testHooks)}')`))
  if (mod.provider) {
    const pr = mod.provider
    const descriptor = imports.add(`${p}_provider`, importPath(ctx.outDir, pr.descriptorFile))
    const caps = pr.mainCapabilities.map((c, j) => imports.add(`${p}_cap${j}`, importPath(ctx.outDir, c.file)))
    const settings = pr.settingsFile
      ? imports.add(`${p}_settings`, importPath(ctx.outDir, pr.settingsFile))
      : TS_UNDEFINED
    lines.push(
      field(
        F.provider,
        `{ descriptor: ${descriptor}, capabilities: [${caps.join(LIST_SEPARATOR)}], settings: ${settings} }`,
      ),
    )
  }
  return `${INDENT}{\n${lines.join('\n')}\n${INDENT}},`
}

function rendererRecord(mod: DiscoveredModule, i: number, ctx: RenderContext, imports: ImportList): string {
  const p = `r${i}`
  const renderer = mod.rendererEntry
    ? imports.add(`${p}_renderer`, importPath(ctx.outDir, mod.rendererEntry))
    : TS_UNDEFINED
  const lines = [
    field(F.id, json(mod.id)),
    field(F.manifest, json(mod.manifest)),
    field(F.renderer, renderer),
    field(F.locales, json(moduleLocales(mod).locales)),
  ]
  if (mod.provider) {
    const pr = mod.provider
    const descriptor = imports.add(`${p}_provider`, importPath(ctx.outDir, pr.descriptorFile))
    const icon = pr.iconFile ? imports.add(`${p}_icon`, importPath(ctx.outDir, pr.iconFile)) : TS_UNDEFINED
    const caps = pr.rendererCapabilities.map((c, j) => imports.add(`${p}_rcap${j}`, importPath(ctx.outDir, c.file)))
    lines.push(
      field(F.provider, `{ descriptor: ${descriptor}, icon: ${icon}, capabilities: [${caps.join(LIST_SEPARATOR)}] }`),
    )
  }
  return `${INDENT}{\n${lines.join('\n')}\n${INDENT}},`
}

function renderFile(
  typeImport: string,
  exportName: string,
  recordType: string,
  body: string[],
  ctx: RenderContext,
  imports: ImportList,
) {
  return [
    AUTO_GENERATED_HEADER,
    typeImport,
    ...imports.lines,
    '',
    `export const coreLocales: Record<string, Record<string, unknown>> = ${json(ctx.coreLocales)}`,
    '',
    `export const ${exportName}: ${recordType}[] = [`,
    ...body,
    ']',
    '',
  ].join('\n')
}

export function renderMainRegistry(mods: readonly DiscoveredModule[], ctx: RenderContext): string {
  const imports = new ImportList()
  const body = mods.map((m, i) => mainRecord(m, i, ctx, imports))
  return renderFile(
    "import type { ModuleRecord } from '@pragma/sdk/runtime/main'",
    'mainModules',
    'ModuleRecord',
    body,
    ctx,
    imports,
  )
}

export function renderRendererRegistry(mods: readonly DiscoveredModule[], ctx: RenderContext): string {
  const imports = new ImportList()
  const body = mods.map((m, i) => rendererRecord(m, i, ctx, imports))
  return renderFile(
    "import type { RendererModuleRecord } from '@pragma/sdk/runtime/renderer'",
    'rendererModules',
    'RendererModuleRecord',
    body,
    ctx,
    imports,
  )
}
