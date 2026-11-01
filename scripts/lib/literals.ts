import { existsSync, readFileSync } from 'node:fs'
import { join, matchesGlob, relative, resolve } from 'node:path'
import { globSync } from 'tinyglobby'
import { type AstNode, allowedByComment, isNode, type ParsedFile, parseFile, walk } from './ast.ts'
import {
  ALLOWED_NUMBERS,
  CLASS_HELPERS,
  GITIGNORE,
  I18N_KEY_LITERAL,
  LITERAL_EXCLUDED_GLOBS,
  LITERALS_RULE,
  NODE,
  SCAN_ROOTS,
  SOURCE_EXTENSIONS,
  UPPER_SNAKE,
  UTF8,
} from './constants.ts'
import { packageRootOf } from './packages.ts'

export type LiteralRule = 'repeated-string' | 'magic-number'

export interface LiteralFinding {
  rule: LiteralRule
  file: string
  line: number
  value: string
  count?: number
}

export interface LiteralAllowance {
  file: string
  line: number
  rule: string
  reason: string
}

interface Occurrence {
  file: string
  line: number
  value: string
}

interface FileScan {
  strings: Occurrence[]
  numbers: Occurrence[]
  allowances: LiteralAllowance[]
}

const SOURCE_NODE_PARENTS = new Set([
  'ImportDeclaration',
  NODE.ExportNamedDeclaration,
  'ExportAllDeclaration',
  'ImportExpression',
  'ImportAttribute',
])
/** TS nodes that wrap a value expression rather than a type. */
const TS_VALUE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
])
const KEYED_PARENTS = new Set(['Property', 'PropertyDefinition', 'MethodDefinition', 'AccessorProperty'])
const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])
const CLASS_HELPER_SET = new Set<string>(CLASS_HELPERS)
const ALLOWED_NUMBER_SET = new Set<string>(ALLOWED_NUMBERS)
const CLASS_NAME_ATTR = 'className'
const TS_PREFIX = 'TS'

const child = (value: unknown): AstNode | undefined => (isNode(value) ? value : undefined)
const isIdentifier = (node: AstNode | undefined): node is AstNode => node?.type === NODE.Identifier
const isUnary = (node: AstNode | undefined, operator: string): boolean =>
  node?.type === NODE.UnaryExpression && node.operator === operator

function stringValue(node: AstNode): string | undefined {
  if (node.type === NODE.Literal && typeof node.value === 'string') return node.value
  if (node.type !== NODE.TemplateLiteral || (node.expressions as unknown[]).length > 0) return undefined
  const quasi = child((node.quasis as unknown[])[0])
  const cooked = (quasi?.value as { cooked?: unknown } | undefined)?.cooked
  return typeof cooked === 'string' ? cooked : undefined
}

function numberValue(node: AstNode, parent: AstNode | undefined): string | undefined {
  if (node.type !== NODE.Literal) return undefined
  if (typeof node.value !== 'number' && typeof node.bigint !== 'string') return undefined
  const raw = String(node.raw)
  return isUnary(parent, '-') ? `-${raw}` : raw
}

const inTypePosition = (ancestors: readonly AstNode[]): boolean =>
  ancestors.some((a) => a.type.startsWith(TS_PREFIX) && !TS_VALUE_WRAPPERS.has(a.type))

const isPropertyKey = (node: AstNode, parent: AstNode | undefined): boolean =>
  parent !== undefined &&
  (KEYED_PARENTS.has(parent.type) || parent.type === NODE.TSPropertySignature) &&
  parent.key === node &&
  parent.computed !== true

function inClassName(ancestors: readonly AstNode[]): boolean {
  return ancestors.some((a) => {
    if (a.type === NODE.JSXAttribute) return child(a.name)?.name === CLASS_NAME_ATTR
    if (a.type !== NODE.CallExpression) return false
    const callee = child(a.callee)
    return isIdentifier(callee) && CLASS_HELPER_SET.has(String(callee.name))
  })
}

function isTypeofOperand(node: AstNode, parent: AstNode | undefined): boolean {
  if (parent?.type !== NODE.BinaryExpression || !EQUALITY_OPERATORS.has(String(parent.operator))) return false
  const other = child(parent.left === node ? parent.right : parent.left)
  return isUnary(other, 'typeof')
}

function isTopLevel(ancestors: readonly AstNode[], declarationIndex: number): boolean {
  const containerIndex = declarationIndex - 1
  const container = ancestors[containerIndex]
  if (container?.type === NODE.Program) return true
  return container?.type === NODE.ExportNamedDeclaration && ancestors[containerIndex - 1]?.type === NODE.Program
}

/** True when the literal sits inside a top-level `const UPPER_SNAKE = …` initializer. */
function inUpperConst(ancestors: readonly AstNode[]): boolean {
  return ancestors.some((a, i) => {
    if (a.type !== NODE.VariableDeclarator) return false
    const id = child(a.id)
    if (!isIdentifier(id) || !UPPER_SNAKE.test(String(id.name))) return false
    return ancestors[i - 1]?.kind === 'const' && isTopLevel(ancestors, i - 1)
  })
}

const isModuleSource = (parent: AstNode | undefined): boolean =>
  parent !== undefined &&
  (SOURCE_NODE_PARENTS.has(parent.type) || (parent.type === NODE.ExpressionStatement && Boolean(parent.directive)))

function isIgnoredString(value: string, node: AstNode, parent: AstNode | undefined, ancestors: readonly AstNode[]) {
  if (value.length <= 1 || I18N_KEY_LITERAL.test(value)) return true
  if (isModuleSource(parent) || isPropertyKey(node, parent) || isTypeofOperand(node, parent)) return true
  return inTypePosition(ancestors) || inClassName(ancestors) || inUpperConst(ancestors)
}

const isIgnoredNumber = (value: string, node: AstNode, parent: AstNode | undefined, ancestors: readonly AstNode[]) =>
  ALLOWED_NUMBER_SET.has(value) || isPropertyKey(node, parent) || inTypePosition(ancestors) || inUpperConst(ancestors)

function scanFile(parsed: ParsedFile): FileScan {
  const scan: FileScan = { strings: [], numbers: [], allowances: [] }
  const allowed = (line: number): boolean => {
    const reason = allowedByComment(parsed, line, LITERALS_RULE)
    if (reason === undefined) return false
    if (!scan.allowances.some((a) => a.line === line))
      scan.allowances.push({ file: parsed.path, line, rule: LITERALS_RULE, reason })
    return true
  }
  walk(parsed.program, (node, parent, ancestors) => {
    const str = stringValue(node)
    const value = str ?? numberValue(node, parent)
    if (value === undefined) return
    const ignored =
      str !== undefined
        ? isIgnoredString(str, node, parent, ancestors)
        : isIgnoredNumber(value, node, parent, ancestors)
    if (ignored) return
    const line = parsed.lineOf(node.start)
    if (allowed(line)) return
    const bucket = str !== undefined ? scan.strings : scan.numbers
    bucket.push({ file: parsed.path, line, value })
  })
  return scan
}

function gitignoreGlobs(repoRoot: string): string[] {
  const file = join(repoRoot, GITIGNORE)
  if (!existsSync(file)) return []
  return readFileSync(file, UTF8)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => {
      const dir = l.endsWith('/')
      const clean = l.replace(/\/$/, '')
      const anchored = clean.includes('/') ? clean : `**/${clean}`
      return dir ? `${anchored}/**` : anchored
    })
}

function scanFiles(repoRoot: string): string[] {
  const patterns = SCAN_ROOTS.flatMap((root) => SOURCE_EXTENSIONS.map((ext) => `${root}/**/*.${ext}`))
  return globSync(patterns, {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', ...gitignoreGlobs(repoRoot), ...LITERAL_EXCLUDED_GLOBS],
  })
}

const matchesAny = (path: string): boolean => LITERAL_EXCLUDED_GLOBS.some((glob) => matchesGlob(path, glob))

function isExcluded(file: string, repoRoot: string): boolean {
  return matchesAny(relative(packageRootOf(file, repoRoot), file))
}

function repeatedStrings(occurrences: { pkg: string; occ: Occurrence }[]): LiteralFinding[] {
  const groups = new Map<string, Occurrence[]>()
  for (const { pkg, occ } of occurrences) {
    const key = `${pkg}\0${occ.value}`
    groups.set(key, [...(groups.get(key) ?? []), occ])
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => group.map((o) => ({ rule: 'repeated-string' as const, ...o, count: group.length })))
}

const byLocation = (a: LiteralFinding, b: LiteralFinding): number =>
  a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)

export function checkLiterals(opts: { repoRoot: string; files?: string[] }): {
  findings: LiteralFinding[]
  allowances: LiteralAllowance[]
} {
  const repoRoot = resolve(opts.repoRoot)
  const files = (opts.files ?? scanFiles(repoRoot)).map((f) => resolve(f)).filter((f) => !isExcluded(f, repoRoot))
  const strings: { pkg: string; occ: Occurrence }[] = []
  const numbers: LiteralFinding[] = []
  const allowances: LiteralAllowance[] = []
  for (const file of files) {
    const scan = scanFile(parseFile(file, readFileSync(file, UTF8)))
    const pkg = packageRootOf(file, repoRoot)
    strings.push(...scan.strings.map((occ) => ({ pkg, occ })))
    numbers.push(...scan.numbers.map((o) => ({ rule: 'magic-number' as const, ...o })))
    allowances.push(...scan.allowances)
  }
  return { findings: [...repeatedStrings(strings), ...numbers].sort(byLocation), allowances }
}
