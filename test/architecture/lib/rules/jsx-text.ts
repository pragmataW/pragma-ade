import { type AstNode, isNode, walk } from '../../../../scripts/lib/ast.ts'
import { isTestCode, type SourceFile } from '../files.ts'
import type { Violation } from '../report.ts'

const RULE = 'jsx-text'
const LETTER = /\p{L}/u
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label', 'aria-description'])
const RENDERER_ROOTS = /^(apps|packages|modules|providers)\//
/** Generated shadcn sources are never edited; the wrappers turn their built-in English text off. */
const VENDOR = /^packages\/ui\/src\/vendor\//

function literalText(node: unknown): string | undefined {
  if (!isNode(node)) return undefined
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0)
    return ((node.quasis as AstNode[])[0]?.value as { cooked?: string } | undefined)?.cooked
  if (node.type === 'JSXExpressionContainer') return literalText(node.expression)
  return undefined
}

const hasLetter = (text: string | undefined): text is string => text !== undefined && LETTER.test(text)

function attributeFinding(node: AstNode): string | undefined {
  const name = isNode(node.name) ? String(node.name.name) : ''
  const text = literalText(node.value)
  return TEXT_ATTRIBUTES.has(name) && hasLetter(text) ? `${name}="${text}"` : undefined
}

function finding(node: AstNode, parent: AstNode | undefined): string | undefined {
  if (node.type === 'JSXText')
    return hasLetter(String(node.value)) ? `JSX text "${String(node.value).trim()}"` : undefined
  if (node.type === 'JSXAttribute') return attributeFinding(node)
  const isChild =
    node.type === 'JSXExpressionContainer' && (parent?.type === 'JSXElement' || parent?.type === 'JSXFragment')
  const text = isChild ? literalText(node.expression) : undefined
  return hasLetter(text) ? `string child "${text}"` : undefined
}

/** No user-visible literal text in JSX (§1.7): everything goes through i18n keys. */
export function checkJsxText(files: readonly SourceFile[]): Violation[] {
  const out: Violation[] = []
  const tsx = files.filter(
    (f) => f.rel.endsWith('.tsx') && RENDERER_ROOTS.test(f.rel) && !VENDOR.test(f.rel) && !isTestCode(f.rel),
  )
  for (const file of tsx) {
    walk(file.parsed.program, (node, parent) => {
      const message = finding(node, parent)
      if (message) out.push({ rule: RULE, file: file.rel, line: file.parsed.lineOf(node.start), message })
    })
  }
  return out
}
