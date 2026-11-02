import { integer, primaryKey, sqliteTable, text } from '@pragma/sdk/db'
import { TABLES } from '../constants'

const ENTRY_ID = 'entry_id'

/** Drizzle views of `migrations/1301_local_history.sql`. */
export const entries = sqliteTable(TABLES.entries, {
  id: integer('id').primaryKey({ autoIncrement: true }),
  worktreeId: text('worktree_id').notNull(),
  cwd: text('cwd').notNull(),
  reason: text('reason').notNull(),
  createdAt: integer('created_at').notNull(),
  headSha: text('head_sha'),
  restoredAt: integer('restored_at'),
})

export const files = sqliteTable(
  TABLES.files,
  {
    entryId: integer(ENTRY_ID).notNull(),
    path: text('path').notNull(),
    state: text('state').notNull(),
    blob: text('blob'),
    size: integer('size').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.path] })],
)

export const stashes = sqliteTable(
  TABLES.stashes,
  {
    entryId: integer(ENTRY_ID).notNull(),
    sha: text('sha').notNull(),
    message: text('message').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.sha] })],
)
