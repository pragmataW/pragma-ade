import { randomUUID } from 'node:crypto'
import { asc, eq, inArray, type PragmaDb } from '@pragma/sdk/db'
import { BrowserElementContextSchema, type Comment, type CommentPatch, CommentPatchSchema } from '../contract'
import { type CommentRow, reviewComments as T } from './schema'

export type NewCommentRow = Omit<Comment, 'id' | 'updatedAt'>

export interface CommentsRepository {
  /** id = uuid, updatedAt = createdAt. */
  insert(row: NewCommentRow): Comment
  get(id: string): Comment | undefined
  getMany(ids: string[]): Comment[]
  /** undefined if missing. */
  update(id: string, patch: CommentPatch, updatedAt: number): Comment | undefined
  remove(id: string): boolean
  /** createdAt asc. */
  list(worktreeId: string): Comment[]
  /** One transaction (delivered comments); returns the number deleted. */
  removeMany(ids: string[]): number
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
  return {
    insert(row) {
      const id = randomUUID()
      const { element, ...fields } = row
      db.insert(T)
        .values({ ...fields, id, elementJson: element ? JSON.stringify(element) : null, updatedAt: row.createdAt })
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
        .where(eq(T.id, id))
        .run().changes
      return changed ? get(id) : undefined
    },
    remove: (id) => db.delete(T).where(eq(T.id, id)).run().changes > 0,
    list: (worktreeId) =>
      db.select().from(T).where(eq(T.worktreeId, worktreeId)).orderBy(asc(T.createdAt)).all().map(toComment),
    removeMany(ids) {
      if (!ids.length) return 0
      return db.transaction((tx) => tx.delete(T).where(inArray(T.id, ids)).run().changes)
    },
    removeByWorktree: (worktreeId) => db.delete(T).where(eq(T.worktreeId, worktreeId)).run().changes,
  }
}
