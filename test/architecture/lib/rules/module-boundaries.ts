import { builtinModules } from 'node:module'
import { dirname, join, normalize } from 'node:path'
import { importsOf, isTestCode, matchesAny, type SourceFile } from '../files.ts'
import type { Violation } from '../report.ts'

const RULE = 'module-boundaries'
const MODULE_SCOPE = /^@pragma\/module-[^/]+/
const PROVIDER_SCOPE = /^@pragma\/provider-/
const BANNED_IN_MODULE_SRC = /^@pragma\/(sdk\/runtime(\/|$)|test-support(\/|$))/
const PACKAGE_ROOT = /^((?:modules|providers)\/[^/]+\/packages\/[^/]+|(?:modules|providers|apps|packages)\/[^/]+)/
const MODULE_SRC = /^(modules|providers)\/[^/]+\/src\//
const NODE_ONLY = new Set([...builtinModules, 'electron', 'better-sqlite3'])
/** test-support loads module folders through the generator's discovery code (00 decision). */
const RELATIVE_EXCEPTIONS: [RegExp, RegExp][] = [[/^packages\/test-support\//, /^scripts\/lib\//]]

export interface WorkspaceInfo {
  /** Package name owning a root-relative path (structural: modules/<id>, providers/<id>, sub-packages, apps, packages). */
  packageRoot(rel: string): string
}

export const structuralWorkspace: WorkspaceInfo = {
  packageRoot: (rel) => PACKAGE_ROOT.exec(rel)?.[1] ?? '',
}

const ENTRY_RULES: Record<string, (rel: string) => boolean> = {
  '/contract': () => true,
  '/renderer': (rel) => rel.includes('/src/renderer/'),
  '/client': (rel) =>
    rel.includes('/src/client/') || /^(modules|providers)\/[^/]+\/packages\//.test(rel) || isTestCode(rel),
  '/testing': (rel) => isTestCode(rel),
}

function moduleEntryProblem(rel: string, source: string): string | undefined {
  const pkg = MODULE_SCOPE.exec(source)?.[0] as string
  const own = rel.split('/')[1]
  if (pkg === `@pragma/module-${own}`) return undefined
  const subpath = source.slice(pkg.length)
  const allowed = ENTRY_RULES[subpath]
  if (allowed?.(rel)) return undefined
  return subpath ? `${source}: entry point ${subpath} is not allowed here` : `${source}: import an entry point`
}

function providerProblem(rel: string, source: string): string | undefined {
  const own = /^providers\/([^/]+)\//.exec(rel)?.[1]
  if (own && (source === `@pragma/provider-${own}` || source.startsWith(`@pragma/provider-${own}-`))) return undefined
  return `${source}: provider packages may not be imported`
}

function relativeProblem(rel: string, source: string, ws: WorkspaceInfo): string | undefined {
  const target = normalize(join(dirname(rel), source))
  const root = ws.packageRoot(rel)
  if (!root || target === root || target.startsWith(`${root}/`)) return undefined
  if (RELATIVE_EXCEPTIONS.some(([from, to]) => from.test(rel) && to.test(target))) return undefined
  return `${source} leaves its package`
}

const isNodeOnly = (source: string): boolean => source.startsWith('node:') || NODE_ONLY.has(source.split('/')[0] ?? '')
const isRendererOrContract = (rel: string): boolean => /\/src\/(renderer|contract)\//.test(rel)

function problemFor(rel: string, source: string, ws: WorkspaceInfo): string | undefined {
  if (source.startsWith('.')) return relativeProblem(rel, source, ws)
  if (MODULE_SCOPE.test(source)) return moduleEntryProblem(rel, source)
  if (PROVIDER_SCOPE.test(source)) return providerProblem(rel, source)
  if (MODULE_SRC.test(rel) && BANNED_IN_MODULE_SRC.test(source)) return `${source} is not available to modules`
  if (isRendererOrContract(rel) && isNodeOnly(source)) return `${source} cannot be used in renderer/contract code`
  return undefined
}

function shellProblem(rel: string, source: string): string | undefined {
  if (!rel.startsWith('apps/desktop/src/') || rel.includes('/generated/')) return undefined
  const touchesModules =
    MODULE_SCOPE.test(source) || PROVIDER_SCOPE.test(source) || /\/(modules|providers)\//.test(source)
  return touchesModules ? `the shell must not import ${source}` : undefined
}

/** Entry-point, provider, runtime, renderer-Node and shell import rules (§1.4, §10.1.1, §10.4). */
export function checkModuleBoundaries(
  files: readonly SourceFile[],
  ws: WorkspaceInfo = structuralWorkspace,
): Violation[] {
  const out: Violation[] = []
  for (const file of files.filter((f) => !matchesAny(f.rel, ['scripts/**']))) {
    for (const ref of importsOf(file)) {
      const message = shellProblem(file.rel, ref.source) ?? problemFor(file.rel, ref.source, ws)
      if (message) out.push({ rule: RULE, file: file.rel, line: ref.line, message })
    }
  }
  return out
}
