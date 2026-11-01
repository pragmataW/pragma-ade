import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { COLUMNS as C, TABLES } from '../constants'

const id = () => text(C.id).primaryKey()
const createdAt = () => integer(C.createdAt).notNull()
const archivedAt = () => integer(C.archivedAt)

/** Drizzle view of `migrations/0101_projects.sql`. Rows are archived, never deleted. */
export const projectsProjects = sqliteTable(TABLES.projects, {
  id: id(),
  name: text(C.name).notNull(),
  repoPath: text(C.repoPath).notNull(),
  defaultBaseBranch: text(C.defaultBaseBranch).notNull(),
  createdAt: createdAt(),
  sortOrder: integer(C.sortOrder).notNull(),
  archivedAt: archivedAt(),
})

export const projectsWorktrees = sqliteTable(TABLES.worktrees, {
  id: id(),
  projectId: text(C.projectId).notNull(),
  path: text(C.path).notNull(),
  branch: text(C.branch),
  baseBranch: text(C.baseBranch).notNull(),
  isMain: integer(C.isMain, { mode: 'boolean' }).notNull(),
  createdAt: createdAt(),
  archivedAt: archivedAt(),
})

export const projectsState = sqliteTable(TABLES.state, {
  key: text(C.key).primaryKey(),
  value: text(C.value),
})
