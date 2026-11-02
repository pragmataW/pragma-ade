import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { COMMENT_SOURCES, DIFF_SIDES } from '../contract'

export const COMMENTS_TABLE = 'comments_review_comments'
const COLUMNS = {
  id: 'id',
  worktreeId: 'worktree_id',
  source: 'source',
  filePath: 'file_path',
  lineStart: 'line_start',
  lineEnd: 'line_end',
  diffSide: 'diff_side',
  snippet: 'snippet',
  language: 'language',
  elementJson: 'element_json',
  body: 'body',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const
const C = COLUMNS

/** Drizzle view of `migrations/0501_comments_review_comments.sql` after `0502_comments_drop_sent.sql`. */
export const reviewComments = sqliteTable(COMMENTS_TABLE, {
  id: text(C.id).primaryKey(),
  worktreeId: text(C.worktreeId).notNull(),
  source: text(C.source, { enum: COMMENT_SOURCES }).notNull(),
  filePath: text(C.filePath),
  lineStart: integer(C.lineStart),
  lineEnd: integer(C.lineEnd),
  diffSide: text(C.diffSide, { enum: DIFF_SIDES }),
  snippet: text(C.snippet),
  language: text(C.language),
  elementJson: text(C.elementJson),
  body: text(C.body).notNull(),
  createdAt: integer(C.createdAt).notNull(),
  updatedAt: integer(C.updatedAt).notNull(),
})
export type CommentRow = typeof reviewComments.$inferSelect
