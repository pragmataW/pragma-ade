import { join } from 'node:path'
import {
  type EditorThread,
  type EditorThreadReply,
  REPLY_AUTHOR,
  THREAD_STATUS,
  type ThreadStatus,
} from '@pragma/module-editor/contract'
import { COMMENT_MESSAGES as M, THREAD_CONTEXT } from '../constants'
import type { ThreadCommentSpec, ThreadSpec } from '../vscodeApi'

/** A drawn review thread (`threads` test op): worktree-relative path, 0-based lines. */
export interface ThreadInfo {
  id: string
  path: string
  startLine: number
  endLine: number
  status: ThreadStatus
  body: string
  replies: { author: string; body: string }[]
}

const pendingLabel = (pending: boolean): Pick<ThreadCommentSpec, 'label'> => (pending ? { label: M.pendingLabel } : {})
const authorOf = (r: EditorThreadReply): string => (r.author === REPLY_AUTHOR.user ? M.author : (r.label ?? M.agent))

/** Root (You) and replies (You / agent label / Agent), Pending on unsent items. */
export function toThreadSpec(folder: string, t: EditorThread): ThreadSpec {
  const resolved = t.status === THREAD_STATUS.resolved
  return {
    id: t.id,
    path: join(folder, t.filePath),
    startLine: t.lineStart - 1,
    endLine: t.lineEnd - 1,
    comments: [
      { body: t.body, author: M.author, ...pendingLabel(t.pending) },
      ...t.replies.map((r) => ({ body: r.body, author: authorOf(r), ...pendingLabel(r.pending) })),
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
  body: t.body,
  replies: t.replies.map((r) => ({ author: authorOf(r), body: r.body })),
})
