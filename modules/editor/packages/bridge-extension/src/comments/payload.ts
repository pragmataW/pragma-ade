import { relative } from 'node:path'
import type { CommentAction, EditorComment } from '@pragma/module-editor/contract'
import { COMMENT_MESSAGES, FILE_SCHEME, PLAINTEXT } from '../constants'
import { isInsideFolder } from '../handlers/openFile'

const BACKSLASH_RE = /\\/g
const SLASH = '/'
const NEWLINE = '\n'
const EXTENSION_RE = /\.[^./\\]+$/

/** undefined when the file has an extension (comments derives the language from the path), else the languageId. */
export function languageHint(filePath: string, languageId: string): string | undefined {
  if (EXTENSION_RE.test(filePath) || languageId === PLAINTEXT) return undefined
  return languageId
}

export interface CommentPayloadInput {
  folderPath: string
  docPath: string
  docScheme: string
  startLine0: number
  endLine0: number
  /** Full document lines. */
  lineTexts: string[]
  languageId: string
  body: string
  action: CommentAction
}

/** Thread + document → `editor.comment`: worktree-relative `/` path, 1-based lines, code excerpt, trimmed body. */
export function buildCommentPayload(
  i: CommentPayloadInput,
): { ok: true; payload: EditorComment } | { ok: false; message: string } {
  const body = i.body.trim()
  if (!body) return { ok: false, message: COMMENT_MESSAGES.empty }
  if (i.docScheme !== FILE_SCHEME || !isInsideFolder(i.folderPath, i.docPath))
    return { ok: false, message: COMMENT_MESSAGES.outside }
  const filePath = relative(i.folderPath, i.docPath).replace(BACKSLASH_RE, SLASH)
  const start = Math.min(i.startLine0, i.endLine0)
  const end = Math.max(i.startLine0, i.endLine0)
  const language = languageHint(filePath, i.languageId)
  return {
    ok: true,
    payload: {
      action: i.action,
      filePath,
      lineStart: start + 1,
      lineEnd: end + 1,
      snippet: i.lineTexts.slice(start, end + 1).join(NEWLINE),
      ...(language ? { language } : {}),
      body,
    },
  }
}
