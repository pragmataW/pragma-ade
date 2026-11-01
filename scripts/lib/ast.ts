import { parseSync } from 'oxc-parser'

/** A loosely typed ESTree node as produced by oxc-parser. */
export interface AstNode {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

export interface AstComment {
  type: string
  value: string
  start: number
  end: number
}

export interface ParsedFile {
  path: string
  code: string
  program: AstNode
  comments: AstComment[]
  lineOf(offset: number): number
}

export type Visitor = (node: AstNode, parent: AstNode | undefined, ancestors: readonly AstNode[]) => void

const LINT_ALLOW = /lint-allow:\s*(?<rule>[\w-]+)\s*[—–-]+\s*(?<reason>.+)$/

function lineStarts(code: string): number[] {
  const starts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1)
  return starts
}

function makeLineOf(code: string): (offset: number) => number {
  const starts = lineStarts(code)
  return (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((starts[mid] ?? 0) <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

export function parseFile(path: string, code: string): ParsedFile {
  const result = parseSync(path, code)
  if (result.errors.length > 0) {
    const first = result.errors[0]
    throw new Error(`parse error in ${path}: ${first?.message ?? 'unknown'}`)
  }
  return {
    path,
    code,
    program: result.program as unknown as AstNode,
    comments: result.comments as AstComment[],
    lineOf: makeLineOf(code),
  }
}

export const isNode = (v: unknown): v is AstNode =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'

function children(node: AstNode): AstNode[] {
  const out: AstNode[] = []
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) out.push(item)
    } else if (isNode(value)) out.push(value)
  }
  return out
}

export function walk(root: AstNode, visit: Visitor): void {
  const ancestors: AstNode[] = []
  const step = (node: AstNode): void => {
    visit(node, ancestors.at(-1), ancestors)
    ancestors.push(node)
    for (const child of children(node)) step(child)
    ancestors.pop()
  }
  step(root)
}

/** Returns the reason when `// lint-allow: <rule> — <reason>` sits on `line` or the line above. */
export function allowedByComment(file: ParsedFile, line: number, rule: string): string | undefined {
  for (const comment of file.comments) {
    const commentLine = file.lineOf(comment.start)
    if (commentLine !== line && commentLine !== line - 1) continue
    const match = LINT_ALLOW.exec(comment.value.trim())
    if (match?.groups?.rule === rule) return match.groups.reason?.trim()
  }
  return undefined
}
