import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, type PragmaDb } from '@pragma/sdk/db'
import {
  BrowserElementContextSchema,
  COMMENT_STATUS,
  type Comment,
  type CommentPatch,
  CommentPatchSchema,
  type CommentStatus,
} from '../contract'
import { type CommentRow, reviewComments as T } from './schema'

export type NewCommentRow = Omit<Comment, 'id' | 'status' | 'targetSessionId' | 'sentAt' | 'updatedAt'>

export interface CommentsRepository {
  /** id = uuid, status `draft`, updatedAt = createdAt. */
  insert(row: NewCommentRow): Comment
  get(id: string): Comment | undefined
  getMany(ids: string[]): Comment[]
  /** undefined if missing or not a draft. */
  update(id: string, patch: CommentPatch, updatedAt: number): Comment | undefined
  remove(id: string): boolean
  /** draft: createdAt asc; sent: sentAt desc; no limit when omitted. */
  list(worktreeId: string, status: CommentStatus, limit?: number): Comment[]
  /** One transaction. */
  markSent(ids: string[], sessionId: string, sentAt: number): void
  removeByWorktree(worktreeId: string): number
}

const orUndefined = <V>(v: V | null): V | undefined => v ?? undefined

/** The single row → DTO conversion (NULL columns become absent fields). */
function toComment(r: CommentRow): Comment {
  const { elementJson, filePath, lineStart, lineEnd, diffSide, snippet, language, ...rest } = r
  return {
    ...rest,
    filePath: orUndefined(filePath),
    lineStart: orUndefined(lineStart),
    lineEnd: orUndefined(lineEnd),
    diffSide: orUndefined(diffSide),
    snippet: orUndefined(snippet),
    language: orUndefined(language),
    element: elementJson ? BrowserElementContextSchema.parse(JSON.parse(elementJson)) : undefined,
  }
}

export function createCommentsRepository(db: PragmaDb): CommentsRepository {
  const get = (id: string): Comment | undefined => {
    const r = db.select().from(T).where(eq(T.id, id)).get()
    return r ? toComment(r) : undefined
  }
  const isDraft = (id: string) => and(eq(T.id, id), eq(T.status, COMMENT_STATUS.draft))
  return {
    insert(row) {
      const id = randomUUID()
      const { element, ...fields } = row
      db.insert(T)
        .values({
          ...fields,
          id,
          elementJson: element ? JSON.stringify(element) : null,
          status: COMMENT_STATUS.draft,
          updatedAt: row.createdAt,
        })
        .run()
      return get(id) as Comment
    },
    get,
    getMany: (ids) => (ids.length ? db.select().from(T).where(inArray(T.id, ids)).all().map(toComment) : []),
    update(id, patch, updatedAt) {
      const values = CommentPatchSchema.parse(patch)
      const changed = db
        .update(T)
        .set({ ...values, updatedAt })
        .where(isDraft(id))
        .run().changes
      return changed ? get(id) : undefined
    },
    remove: (id) => db.delete(T).where(eq(T.id, id)).run().changes > 0,
    list(worktreeId, status, limit) {
      const order = status === COMMENT_STATUS.draft ? asc(T.createdAt) : desc(T.sentAt)
      const query = db
        .select()
        .from(T)
        .where(and(eq(T.worktreeId, worktreeId), eq(T.status, status)))
        .orderBy(order)
      return (limit === undefined ? query.all() : query.limit(limit).all()).map(toComment)
    },
    markSent(ids, sessionId, sentAt) {
      if (!ids.length) return
      db.transaction((tx) => {
        tx.update(T)
          .set({ status: COMMENT_STATUS.sent, targetSessionId: sessionId, sentAt, updatedAt: sentAt })
          .where(inArray(T.id, ids))
          .run()
      })
    },
    removeByWorktree: (worktreeId) => db.delete(T).where(eq(T.worktreeId, worktreeId)).run().changes,
  }
}
