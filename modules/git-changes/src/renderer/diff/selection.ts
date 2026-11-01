import type { SelectedLineRange } from '@pierre/diffs/react'
import { COMMENT_SOURCE, type CommentContext, DIFF_SIDE } from '@pragma/module-comments/contract'
import { ADDITIONS, toDiffSide } from '../lib/comments'

/** File extension → the fence language the agent sees in the comment. */
export const LANGUAGE_BY_EXT: Readonly<Record<string, string>> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  json: 'json',
  md: 'md',
  py: 'py',
  go: 'go',
  rs: 'rs',
  css: 'css',
  html: 'html',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
}

const EXT_RE = /\.([^./]+)$/
const LINE_BREAK = /\r?\n/
const NEWLINE = '\n'

export function languageFor(path: string): string {
  const ext = EXT_RE.exec(path)?.[1]?.toLowerCase()
  return (ext && Object.hasOwn(LANGUAGE_BY_EXT, ext) ? LANGUAGE_BY_EXT[ext] : undefined) ?? ''
}

/**
 * A selected diff range as a comment context: one side (a range across both sides collapses to its end line), lines
 * ordered, the snippet from that side's text (LF), the old path for the old side of a rename.
 */
export function toCommentContext(
  r: SelectedLineRange,
  texts: { old: string | null; new: string | null },
  file: { path: string; oldPath?: string },
): CommentContext {
  const side = r.endSide ?? r.side ?? ADDITIONS
  const mixed = r.side !== undefined && r.endSide !== undefined && r.side !== r.endSide
  const lineStart = mixed ? r.end : Math.min(r.start, r.end)
  const lineEnd = mixed ? r.end : Math.max(r.start, r.end)
  const diffSide = toDiffSide(side)
  const text = diffSide === DIFF_SIDE.old ? texts.old : texts.new
  const snippet = (text ?? '')
    .split(LINE_BREAK)
    .slice(lineStart - 1, lineEnd)
    .join(NEWLINE)
  return {
    source: COMMENT_SOURCE.diff,
    filePath: diffSide === DIFF_SIDE.old ? (file.oldPath ?? file.path) : file.path,
    lineStart,
    lineEnd,
    diffSide,
    snippet,
    language: languageFor(file.path),
  }
}
