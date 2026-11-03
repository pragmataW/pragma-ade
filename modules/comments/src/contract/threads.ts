/** Pure review-thread helpers shared by main, the renderers and other modules (no I/O). */
import { COMMENT_SOURCE, type Comment, type CommentReply, DIFF_SIDE, REPLY_AUTHOR } from './dto'

/** The ids one Send delivers: new roots and user replies not sent yet. */
export interface PendingItems {
  commentIds: string[]
  replyIds: string[]
}

/** A root no Send has delivered yet. */
export const isPendingRoot = (c: Pick<Comment, 'round'>): boolean => c.round === undefined
/** A user reply no Send has delivered yet (agent replies are never pending). */
export const isPendingReply = (r: Pick<CommentReply, 'author' | 'round'>): boolean =>
  r.author === REPLY_AUTHOR.user && r.round === undefined

export function pendingItems(threads: readonly Comment[]): PendingItems {
  const commentIds: string[] = []
  const replyIds: string[] = []
  for (const c of threads) {
    if (isPendingRoot(c)) commentIds.push(c.id)
    for (const r of c.replies) if (isPendingReply(r)) replyIds.push(r.id)
  }
  return { commentIds, replyIds }
}

/** New roots + pending user replies (what Send would deliver). */
export function pendingCount(threads: readonly Comment[]): number {
  const p = pendingItems(threads)
  return p.commentIds.length + p.replyIds.length
}

/** A thread on code the editor and the diff's new side show: editor comments and new-side diff comments. */
export const isCodeThread = (c: Pick<Comment, 'source' | 'diffSide' | 'filePath'>): boolean =>
  c.filePath !== undefined &&
  (c.source === COMMENT_SOURCE.editor || (c.source === COMMENT_SOURCE.diff && c.diffSide !== DIFF_SIDE.old))

/** What an agent may read: delivered roots with their delivered replies; undefined for a pending root. */
export function visibleToAgent(c: Comment): Comment | undefined {
  if (isPendingRoot(c)) return undefined
  return { ...c, replies: c.replies.filter((r) => r.round !== undefined) }
}
