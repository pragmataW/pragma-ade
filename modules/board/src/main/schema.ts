import { integer, primaryKey, sqliteTable, text } from '@pragma/sdk/db'
import { LABEL_COLORS, PRIORITIES } from '../contract'

const ID = 'id'
const BOARD_ID = 'board_id'
const NAME = 'name'
const SORT_ORDER = 'sort_order'
const CREATED_AT = 'created_at'

/** Drizzle view of migrations 0901 + 0902. */
export const boardBoards = sqliteTable('board_boards', {
  id: integer(ID).primaryKey({ autoIncrement: true }),
  projectId: text('project_id').unique(),
  name: text(NAME).notNull(),
  keyPrefix: text('key_prefix').notNull(),
  nextNumber: integer('next_number').notNull(),
  createdAt: integer(CREATED_AT).notNull(),
})

export const boardColumns = sqliteTable('board_columns', {
  id: integer(ID).primaryKey({ autoIncrement: true }),
  boardId: integer(BOARD_ID).notNull(),
  name: text(NAME).notNull(),
  sortOrder: text(SORT_ORDER).notNull(),
  description: text('description').notNull().default(''),
})

export const boardLabels = sqliteTable('board_labels', {
  id: integer(ID).primaryKey({ autoIncrement: true }),
  boardId: integer(BOARD_ID).notNull(),
  name: text(NAME).notNull(),
  color: text('color', { enum: LABEL_COLORS }).notNull(),
})

export const boardTasks = sqliteTable('board_tasks', {
  id: integer(ID).primaryKey({ autoIncrement: true }),
  boardId: integer(BOARD_ID).notNull(),
  number: integer('number').notNull(),
  columnId: integer('column_id').notNull(),
  title: text('title').notNull(),
  descriptionMd: text('description_md').notNull(),
  priority: text('priority', { enum: PRIORITIES }).notNull(),
  labelsJson: text('labels_json').notNull(),
  worktreeId: text('worktree_id'),
  sortOrder: text(SORT_ORDER).notNull(),
  createdAt: integer(CREATED_AT).notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const boardTaskSessions = sqliteTable(
  'board_task_sessions',
  {
    taskId: integer('task_id').notNull(),
    agentSessionId: text('agent_session_id').notNull(),
    linkedAt: integer('linked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.agentSessionId] })],
)

export type BoardRow = typeof boardBoards.$inferSelect
export type ColumnRow = typeof boardColumns.$inferSelect
export type ColumnInsert = Omit<typeof boardColumns.$inferInsert, 'id'>
export type LabelRow = typeof boardLabels.$inferSelect
export type TaskRow = typeof boardTasks.$inferSelect
export type TaskInsert = typeof boardTasks.$inferInsert
export type SessionLinkRow = typeof boardTaskSessions.$inferSelect
