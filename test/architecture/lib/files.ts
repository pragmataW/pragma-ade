import { readFileSync } from 'node:fs'
import { join, matchesGlob } from 'node:path'
import { globSync } from 'tinyglobby'
import { type AstNode, isNode, type ParsedFile, parseFile, walk } from '../../../scripts/lib/ast.ts'

export interface SourceFile {
  /** Path relative to the scanned root, with `/` separators. */
  rel: string
  parsed: ParsedFile
}

const SCAN = ['{apps,packages,modules,providers,scripts}/**/*.{ts,tsx}']
const IGNORE = ['**/node_modules/**', '**/out/**', '**/out-*/**', '**/generated/**', '**/fixtures/**', '**/*.d.ts']
const TEST_CODE = ['**/test/**', '**/e2e/**', '**/testing/**', '**/*.test.ts', '**/*.test.tsx', '**/*.e2e.ts']

const cache = new Map<string, SourceFile[]>()

/** Every TS/TSX source under the root's apps, packages, modules, providers and scripts folders, parsed once. */
export function collectFiles(root: string): SourceFile[] {
  const hit = cache.get(root)
  if (hit) return hit
  const files = globSync(SCAN, { cwd: root, ignore: IGNORE })
    .sort()
    .map((rel) => ({ rel, parsed: parseFile(join(root, rel), readFileSync(join(root, rel), 'utf8')) }))
  cache.set(root, files)
  return files
}

export const matchesAny = (rel: string, globs: readonly string[]): boolean => globs.some((g) => matchesGlob(rel, g))
export const isTestCode = (rel: string): boolean => matchesAny(rel, TEST_CODE)

export interface ImportRef {
  source: string
  line: number
  node: AstNode
}

const IMPORT_TYPES = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportAllDeclaration',
  'ImportExpression',
])

/** Static and dynamic import/export sources of a file. */
export function importsOf(file: SourceFile): ImportRef[] {
  const out: ImportRef[] = []
  walk(file.parsed.program, (node) => {
    if (!IMPORT_TYPES.has(node.type)) return
    const source = isNode(node.source) ? node.source : undefined
    if (source?.type === 'Literal' && typeof source.value === 'string')
      out.push({ source: source.value, line: file.parsed.lineOf(node.start), node })
  })
  return out
}
