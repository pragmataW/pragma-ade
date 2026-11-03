/** Comments threads ↔ the `editor` bridge shapes (pure). */
import {
  type Comment,
  type CommentReply,
  isCodeThread,
  isPendingReply,
  isPendingRoot,
  SEND_STATUS,
  type SendResult,
} from '@pragma/module-comments/contract'
import {
  COMMENT_REPLY,
  type EditorSendReply,
  type EditorThread,
  type EditorThreadReply,
  type EditorThreads,
} from '../../contract'

const toReply = (r: CommentReply): EditorThreadReply => ({
  id: r.id,
  author: r.author,
  label: r.authorLabel ?? null,
  body: r.body,
  pending: isPendingReply(r),
})

/**
 * The threads the workbench shows: editor comments and the diff's new-side comments with lines (old-side diff and
 * browser threads stay in their own panels).
 */
export function toEditorThreads(comments: readonly Comment[]): EditorThreads {
  const threads: EditorThread[] = []
  for (const c of comments) {
    if (!isCodeThread(c) || !c.filePath || c.lineStart === undefined) continue
    threads.push({
      id: c.id,
      source: c.source,
      filePath: c.filePath,
      lineStart: c.lineStart,
      lineEnd: c.lineEnd ?? c.lineStart,
      status: c.status,
      pending: isPendingRoot(c),
      body: c.body,
      replies: c.replies.map(toReply),
    })
  }
  return { threads }
}

/** A review round's SendResult as the extension reports it. */
export function sendOutcome(r: SendResult): EditorSendReply {
  switch (r.status) {
    case SEND_STATUS.sent:
      return { status: COMMENT_REPLY.sent }
    case SEND_STATUS.needsTarget:
    case SEND_STATUS.noSession:
      return { status: COMMENT_REPLY.needsUserAction }
    case SEND_STATUS.failed:
      return { status: COMMENT_REPLY.failed, message: r.message ?? r.errorKey }
    default: {
      const never: never = r
      return never
    }
  }
}
