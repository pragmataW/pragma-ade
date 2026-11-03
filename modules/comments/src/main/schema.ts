import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { COMMENT_SOURCES, COMMENT_STATUSES, DIFF_SIDES, REPLY_AUTHORS } from '../contract'

export const COMMENTS_TABLE = 'comments_review_comments'
export const REPLIES_TABLE = 'comments_review_replies'
export const ROUNDS_TABLE = 'comments_review_rounds'
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
  status: 'status',
  round: 'round',
  resolvedAt: 'resolved_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  commentId: 'comment_id',
  author: 'author',
  sessionId: 'session_id',
  authorLabel: 'author_label',
  lastRound: 'last_round',
} as const
const C = COLUMNS

/** Drizzle view of `migrations/0501…` after `0502_comments_drop_sent.sql` and `0503_comments_threads.sql`. */
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
  status: text(C.status, { enum: COMMENT_STATUSES }).notNull(),
  round: integer(C.round),
  resolvedAt: integer(C.resolvedAt),
  createdAt: integer(C.createdAt).notNull(),
  updatedAt: integer(C.updatedAt).notNull(),
})
export type CommentRow = typeof reviewComments.$inferSelect

/** Replies of a thread; `ON DELETE CASCADE` from the root (the SDK enables `foreign_keys`). */
export const reviewReplies = sqliteTable(REPLIES_TABLE, {
  id: text(C.id).primaryKey(),
  commentId: text(C.commentId).notNull(),
  author: text(C.author, { enum: REPLY_AUTHORS }).notNull(),
  body: text(C.body).notNull(),
  sessionId: text(C.sessionId),
  authorLabel: text(C.authorLabel),
  round: integer(C.round),
  createdAt: integer(C.createdAt).notNull(),
})
export type ReplyRow = typeof reviewReplies.$inferSelect

/** The last delivered review round per worktree. */
export const reviewRounds = sqliteTable(ROUNDS_TABLE, {
  worktreeId: text(C.worktreeId).primaryKey(),
  lastRound: integer(C.lastRound).notNull(),
  updatedAt: integer(C.updatedAt).notNull(),
})
