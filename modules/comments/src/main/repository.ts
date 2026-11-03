import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, type PragmaDb } from '@pragma/sdk/db'
import {
  BrowserElementContextSchema,
  COMMENT_STATUS,
  COMMENT_STATUS_FILTER,
  type Comment,
  type CommentPatch,
  CommentPatchSchema,
  type CommentReply,
  type CommentStatus,
  type CommentStatusFilter,
  type PendingItems,
  REPLY_AUTHOR,
} from '../contract'
import { type CommentRow, reviewReplies as R, reviewRounds as RD, type ReplyRow, reviewComments as T } from './schema'

export type NewCommentRow = Omit<Comment, 'id' | 'updatedAt' | 'status' | 'round' | 'resolvedAt' | 'replies'>
export type NewReplyRow = Omit<CommentReply, 'id'>

export interface CommentsRepository {
  /** id = uuid, updatedAt = createdAt, open and pending. */
  insert(row: NewCommentRow): Comment
  get(id: string): Comment | undefined
  getMany(ids: string[]): Comment[]
  /** undefined if missing. */
  update(id: string, patch: CommentPatch, updatedAt: number): Comment | undefined
  /** Replies go with it (`ON DELETE CASCADE`). */
  remove(id: string): boolean
  /** createdAt asc; default every status. */
  list(worktreeId: string, status?: CommentStatusFilter): Comment[]
  insertReply(row: NewReplyRow): CommentReply
  getReply(id: string): CommentReply | undefined
  removeReply(id: string): boolean
  /** undefined if missing; `resolvedAt` = `at` when resolved, cleared when reopened. */
  setStatus(id: string, status: CommentStatus, at: number): Comment | undefined
  /** Reopens the given threads (no-op for open ones). */
  reopen(ids: string[], at: number): void
  /** Deletes the worktree's resolved threads; returns their ids. */
  clearResolved(worktreeId: string): string[]
  /** 0 before the first delivered round. */
  currentRound(worktreeId: string): number
  /**
   * One transaction: round = last + 1, stamps exactly `ids` (still pending ones) with it and reopens every thread
   * that gets a user reply in this round. Returns the new round.
   */
  markDelivered(worktreeId: string, ids: PendingItems, at: number): number
  /** One transaction; returns the number deleted. Removed with the round-based send. */
  removeMany(ids: string[]): number
  /** Threads, replies and the round counter of the worktree; returns the number of threads deleted. */
  removeByWorktree(worktreeId: string): number
}

const orUndefined = <V>(v: V | null): V | undefined => v ?? undefined

function toReply(r: ReplyRow): CommentReply {
  const { sessionId, authorLabel, round, ...rest } = r
  return {
    ...rest,
    sessionId: orUndefined(sessionId),
    authorLabel: orUndefined(authorLabel),
    round: orUndefined(round),
  }
}

/** The single row → DTO conversion (NULL columns become absent fields). */
function toComment(r: CommentRow, replies: CommentReply[]): Comment {
  const { elementJson, filePath, lineStart, lineEnd, diffSide, snippet, language, round, resolvedAt, ...rest } = r
  return {
    ...rest,
    filePath: orUndefined(filePath),
    lineStart: orUndefined(lineStart),
    lineEnd: orUndefined(lineEnd),
    diffSide: orUndefined(diffSide),
    snippet: orUndefined(snippet),
    language: orUndefined(language),
    element: elementJson ? BrowserElementContextSchema.parse(JSON.parse(elementJson)) : undefined,
    round: orUndefined(round),
    resolvedAt: orUndefined(resolvedAt),
    replies,
  }
}

export function createCommentsRepository(db: PragmaDb): CommentsRepository {
  /** Rows → DTOs with their replies (one query for all replies, createdAt asc). */
  const withReplies = (rows: CommentRow[]): Comment[] => {
    if (!rows.length) return []
    const replies = db
      .select()
      .from(R)
      .where(
        inArray(
          R.commentId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(R.createdAt))
      .all()
    const byComment = new Map<string, CommentReply[]>()
    for (const r of replies) byComment.set(r.commentId, [...(byComment.get(r.commentId) ?? []), toReply(r)])
    return rows.map((r) => toComment(r, byComment.get(r.id) ?? []))
  }
  const get = (id: string): Comment | undefined => withReplies(db.select().from(T).where(eq(T.id, id)).all())[0]
  const getReply = (id: string): CommentReply | undefined => {
    const r = db.select().from(R).where(eq(R.id, id)).get()
    return r ? toReply(r) : undefined
  }
  const currentRound = (worktreeId: string): number =>
    db.select().from(RD).where(eq(RD.worktreeId, worktreeId)).get()?.lastRound ?? 0
  const reopen = (ids: string[], at: number): void => {
    if (!ids.length) return
    db.update(T)
      .set({ status: COMMENT_STATUS.open, resolvedAt: null, updatedAt: at })
      .where(and(inArray(T.id, ids), eq(T.status, COMMENT_STATUS.resolved)))
      .run()
  }
  return {
    insert(row) {
      const id = randomUUID()
      const { element, ...fields } = row
      db.insert(T)
        .values({
          ...fields,
          id,
          status: COMMENT_STATUS.open,
          elementJson: element ? JSON.stringify(element) : null,
          updatedAt: row.createdAt,
        })
        .run()
      return get(id) as Comment
    },
    get,
    getMany: (ids) => (ids.length ? withReplies(db.select().from(T).where(inArray(T.id, ids)).all()) : []),
    update(id, patch, updatedAt) {
      const values = CommentPatchSchema.parse(patch)
      const changed = db
        .update(T)
        .set({ ...values, updatedAt })
        .where(eq(T.id, id))
        .run().changes
      return changed ? get(id) : undefined
    },
    remove: (id) => db.delete(T).where(eq(T.id, id)).run().changes > 0,
    list(worktreeId, status = COMMENT_STATUS_FILTER.all) {
      const byWorktree = eq(T.worktreeId, worktreeId)
      const where = status === COMMENT_STATUS_FILTER.all ? byWorktree : and(byWorktree, eq(T.status, status))
      return withReplies(db.select().from(T).where(where).orderBy(asc(T.createdAt)).all())
    },
    insertReply(row) {
      const id = randomUUID()
      db.insert(R)
        .values({ ...row, id })
        .run()
      return getReply(id) as CommentReply
    },
    getReply,
    removeReply: (id) => db.delete(R).where(eq(R.id, id)).run().changes > 0,
    setStatus(id, status, at) {
      const resolvedAt = status === COMMENT_STATUS.resolved ? at : null
      const changed = db.update(T).set({ status, resolvedAt, updatedAt: at }).where(eq(T.id, id)).run().changes
      return changed ? get(id) : undefined
    },
    reopen,
    clearResolved(worktreeId) {
      const where = and(eq(T.worktreeId, worktreeId), eq(T.status, COMMENT_STATUS.resolved))
      return db.transaction((tx) => {
        const ids = tx
          .select({ id: T.id })
          .from(T)
          .where(where)
          .all()
          .map((r) => r.id)
        tx.delete(T).where(where).run()
        return ids
      })
    },
    currentRound,
    markDelivered(worktreeId, { commentIds, replyIds }, at) {
      return db.transaction((tx) => {
        const round = currentRound(worktreeId) + 1
        tx.insert(RD)
          .values({ worktreeId, lastRound: round, updatedAt: at })
          .onConflictDoUpdate({ target: RD.worktreeId, set: { lastRound: round, updatedAt: at } })
          .run()
        if (commentIds.length)
          tx.update(T)
            .set({ round })
            .where(and(inArray(T.id, commentIds), isNull(T.round)))
            .run()
        if (!replyIds.length) return round
        const userReplies = and(inArray(R.id, replyIds), isNull(R.round), eq(R.author, REPLY_AUTHOR.user))
        const threads = tx.selectDistinct({ id: R.commentId }).from(R).where(userReplies).all()
        tx.update(R).set({ round }).where(userReplies).run()
        reopen(
          threads.map((t) => t.id),
          at,
        )
        return round
      })
    },
    removeMany(ids) {
      if (!ids.length) return 0
      return db.transaction((tx) => tx.delete(T).where(inArray(T.id, ids)).run().changes)
    },
    removeByWorktree(worktreeId) {
      return db.transaction((tx) => {
        tx.delete(RD).where(eq(RD.worktreeId, worktreeId)).run()
        return tx.delete(T).where(eq(T.worktreeId, worktreeId)).run().changes
      })
    },
  }
}
