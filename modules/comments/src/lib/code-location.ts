import type { Comment } from '../contract/dto'

/** `path:start-end` (`:start` for one line, just `path` without lines); shared by the formatter and the UI. */
export function codeLocation(c: Pick<Comment, 'filePath' | 'lineStart' | 'lineEnd'>): string {
  const path = c.filePath ?? ''
  if (c.lineStart === undefined) return path
  const range = c.lineEnd !== undefined && c.lineEnd !== c.lineStart ? `${c.lineStart}-${c.lineEnd}` : `${c.lineStart}`
  return `${path}:${range}`
}
