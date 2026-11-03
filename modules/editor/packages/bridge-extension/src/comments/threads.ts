import { join } from 'node:path'
import {
  type EditorThread,
  type EditorThreadReply,
  REPLY_AUTHOR,
  THREAD_STATUS,
  type ThreadStatus,
} from '@pragma/module-editor/contract'
import { COMMENT_CONTEXT, THREAD_LABEL as L, COMMENT_MESSAGES as M, THREAD_CONTEXT } from '../constants'
import type { ThreadCommentSpec, ThreadSpec } from '../vscodeApi'

/** A drawn review thread (`threads` test op): worktree-relative path, 0-based lines. */
export interface ThreadInfo {
  id: string
  path: string
  startLine: number
  endLine: number
  status: ThreadStatus
  /** The header text. */
  label: string
  body: string
  replies: { author: string; body: string; pending: boolean }[]
}

const authorOf = (r: EditorThreadReply): string => (r.author === REPLY_AUTHOR.user ? M.author : (r.label ?? M.agent))

/** Pending items carry the Pending label and context (the discard-reply action keys on it). */
const comment = (body: string, author: string, pending: boolean, createdAt: number): ThreadCommentSpec => ({
  body,
  author,
  ...(pending ? { label: M.pendingLabel } : {}),
  timestamp: createdAt,
  contextValue: pending ? COMMENT_CONTEXT.pending : COMMENT_CONTEXT.sent,
})

/** `L3 · Open`, `L3–5 · Resolved`, `L3 · Open · Pending` (root not sent yet). */
export function threadLabel(t: EditorThread): string {
  const lines = t.lineEnd > t.lineStart ? `${t.lineStart}${L.range}${t.lineEnd}` : `${t.lineStart}`
  const parts = [`${L.line}${lines}`, t.status === THREAD_STATUS.resolved ? L.resolved : L.open]
  if (t.pending) parts.push(M.pendingLabel)
  return parts.join(L.sep)
}

/** Root (You) and replies (You / agent label / Agent), Pending on unsent items. */
export function toThreadSpec(folder: string, t: EditorThread): ThreadSpec {
  const resolved = t.status === THREAD_STATUS.resolved
  return {
    id: t.id,
    path: join(folder, t.filePath),
    startLine: t.lineStart - 1,
    endLine: t.lineEnd - 1,
    label: threadLabel(t),
    comments: [
      comment(t.body, M.author, t.pending, t.createdAt),
      ...t.replies.map((r) => comment(r.body, authorOf(r), r.pending, r.createdAt)),
    ],
    resolved,
    contextValue: resolved ? THREAD_CONTEXT.resolved : THREAD_CONTEXT.open,
  }
}

export const toThreadInfo = (t: EditorThread): ThreadInfo => ({
  id: t.id,
  path: t.filePath,
  startLine: t.lineStart - 1,
  endLine: t.lineEnd - 1,
  status: t.status,
  label: threadLabel(t),
  body: t.body,
  replies: t.replies.map((r) => ({ author: authorOf(r), body: r.body, pending: r.pending })),
})
