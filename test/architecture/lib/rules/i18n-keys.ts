import { join, relative } from 'node:path'
import { I18N_KEY_PATTERN } from '../../../../packages/sdk/src/common/patterns.ts'
import { type AstNode, isNode, walk } from '../../../../scripts/lib/ast.ts'
import { discoverModules } from '../../../../scripts/lib/discover.ts'
import { isTestCode, type SourceFile } from '../files.ts'
import { type LocaleIndex, resolvesKey } from '../locale-index.ts'
import type { Violation } from '../report.ts'

const RULE = 'i18n-keys'
const KEY_PROPERTY = /Key$/
const T_FUNCTION = 't'

const stringValue = (node: unknown): string | undefined =>
  isNode(node) && node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined

function calleeName(node: AstNode): string | undefined {
  const callee = isNode(node.callee) ? node.callee : undefined
  if (callee?.type === 'Identifier') return String(callee.name)
  if (callee?.type === 'MemberExpression' && isNode(callee.property)) return String(callee.property.name)
  return undefined
}

function keyNameOf(node: AstNode): string {
  const key = isNode(node.key) ? node.key : isNode(node.name) ? node.name : undefined
  return key ? String(key.name ?? key.value ?? '') : ''
}

/** The i18n key a node uses, if it is a `t('…')` call, a `*Key: '…'` property or a `*Key="…"` JSX attribute. */
function usedKey(node: AstNode): string | undefined {
  if (node.type === 'CallExpression' && calleeName(node) === T_FUNCTION)
    return stringValue((node.arguments as unknown[])[0])
  if (node.type !== 'Property' && node.type !== 'JSXAttribute') return undefined
  return KEY_PROPERTY.test(keyNameOf(node)) ? stringValue(node.value) : undefined
}

const problemFor = (key: string, index: LocaleIndex): string | undefined => {
  if (!I18N_KEY_PATTERN.test(key)) return `"${key}" is not a fully qualified i18n key`
  return resolvesKey(index, key) ? undefined : `i18n key "${key}" does not resolve`
}

/** `t()` keys, `*Key` properties and manifest `displayNameKey`s must be qualified and resolve (§6). */
export function checkI18nKeys(files: readonly SourceFile[], index: LocaleIndex, root: string): Violation[] {
  const out: Violation[] = []
  for (const file of files.filter((f) => !isTestCode(f.rel) && !f.rel.startsWith('scripts/'))) {
    walk(file.parsed.program, (node) => {
      const key = usedKey(node)
      const message = key === undefined ? undefined : problemFor(key, index)
      if (message) out.push({ rule: RULE, file: file.rel, line: file.parsed.lineOf(node.start), message })
    })
  }
  for (const mod of discoverModules({ repoRoot: root, includeUnderscored: true })) {
    const message = problemFor(mod.manifest.displayNameKey, index)
    const rel = relative(root, join(mod.dir, 'package.json'))
    if (message) out.push({ rule: RULE, file: rel, line: 1, message: `manifest displayNameKey: ${message}` })
  }
  return out
}
