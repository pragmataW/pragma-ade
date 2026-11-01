import { isNode, walk } from '../../../../scripts/lib/ast.ts'
import { matchesAny, type SourceFile } from '../files.ts'
import type { Violation } from '../report.ts'

const RULE = 'provider-branching'
const EXCLUDED = ['providers/**', '**/test/**', '**/e2e/**', '**/fixtures/**', 'scripts/**']
const EQUALITY = new Set(['===', '!==', '==', '!='])

const providerLiteral = (node: unknown, ids: ReadonlySet<string>): string | undefined =>
  isNode(node) && node.type === 'Literal' && typeof node.value === 'string' && ids.has(node.value)
    ? node.value
    : undefined

/** No `if`/`switch` on provider ids outside `providers/` (§1.6). */
export function checkProviderBranching(files: readonly SourceFile[], providerIds: readonly string[]): Violation[] {
  const ids = new Set(providerIds)
  const out: Violation[] = []
  for (const file of files.filter((f) => !matchesAny(f.rel, EXCLUDED))) {
    walk(file.parsed.program, (node) => {
      const isCompare = node.type === 'BinaryExpression' && EQUALITY.has(String(node.operator))
      const id = isCompare
        ? (providerLiteral(node.left, ids) ?? providerLiteral(node.right, ids))
        : node.type === 'SwitchCase'
          ? providerLiteral(node.test, ids)
          : undefined
      if (id !== undefined)
        out.push({
          rule: RULE,
          file: file.rel,
          line: file.parsed.lineOf(node.start),
          message: `branches on provider id "${id}"`,
        })
    })
  }
  return out
}
