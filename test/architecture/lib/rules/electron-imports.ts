import { type AstNode, isNode } from '../../../../scripts/lib/ast.ts'
import { type ImportRef, importsOf, matchesAny, type SourceFile } from '../files.ts'
import type { Violation } from '../report.ts'

const RULE = 'electron-imports'
export const ALLOWED_ELECTRON_MAIN_IMPORTS = ['WebContentsView', 'webContents', 'session', 'protocol', 'net'] as const
const SCOPE = ['modules/*/src/main/**', 'providers/*/src/main/**']
const ALLOWED = new Set<string>(ALLOWED_ELECTRON_MAIN_IMPORTS)

const isTypeOnly = (node: AstNode): boolean => node.importKind === 'type'
const importedName = (spec: AstNode): string => (isNode(spec.imported) ? String(spec.imported.name) : '*')

/** Value imports of a declaration from `electron` that are not on the allow-list. */
function disallowed(ref: ImportRef): string[] {
  if (ref.source !== 'electron' || ref.node.type !== 'ImportDeclaration' || isTypeOnly(ref.node)) return []
  return (ref.node.specifiers as unknown[])
    .filter(isNode)
    .filter((spec) => !isTypeOnly(spec))
    .map(importedName)
    .filter((name) => !ALLOWED.has(name))
}

/** Main-side modules may value-import only the allow-listed electron APIs (§10.1.3, §10.4). */
export function checkElectronImports(files: readonly SourceFile[]): Violation[] {
  return files
    .filter((f) => matchesAny(f.rel, SCOPE))
    .flatMap((file) =>
      importsOf(file).flatMap((ref) =>
        disallowed(ref).map((name) => ({
          rule: RULE,
          file: file.rel,
          line: ref.line,
          message: `electron import "${name}" is not allowed`,
        })),
      ),
    )
}
