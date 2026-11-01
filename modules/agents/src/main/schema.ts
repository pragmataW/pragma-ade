import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { COLUMNS as C, EMPTY_ENV_JSON, TABLES } from '../constants'
import { agentSessionStatuses, agentsErrorCodes, TERMINAL_MODE } from '../contract'

const id = () => text(C.id).primaryKey()
const createdAt = () => integer(C.createdAt).notNull()
const flag = (name: string) => integer(name, { mode: 'boolean' }).notNull()

/** Drizzle view of `migrations/0301_agents_profiles.sql`. `command`/`args` NULL = the provider's stock value. */
export const agentsProfiles = sqliteTable(TABLES.profiles, {
  id: id(),
  providerId: text(C.providerId).notNull(),
  name: text(C.name),
  command: text(C.command),
  args: text(C.args),
  envJson: text(C.envJson).notNull().default(EMPTY_ENV_JSON),
  enabled: flag(C.enabled).default(true),
  isDefault: flag(C.isDefault).default(false),
  isBuiltin: flag(C.isBuiltin).default(false),
  sortOrder: integer(C.sortOrder).notNull(),
  createdAt: createdAt(),
  updatedAt: integer(C.updatedAt).notNull(),
})
export type ProfileRow = typeof agentsProfiles.$inferSelect

/** Drizzle view of `migrations/0302_agents_sessions.sql`; `mode` defaults to `terminal` (11a does not ALTER it). */
export const agentsSessions = sqliteTable(TABLES.sessions, {
  id: id(),
  worktreeId: text(C.worktreeId).notNull(),
  profileId: text(C.profileId),
  providerId: text(C.providerId).notNull(),
  mode: text(C.mode).notNull().default(TERMINAL_MODE),
  ptyId: text(C.ptyId),
  title: text(C.title),
  ordinal: integer(C.ordinal).notNull(),
  status: text(C.status, { enum: agentSessionStatuses }).notNull(),
  externalSessionId: text(C.externalSessionId),
  exitCode: integer(C.exitCode),
  errorCode: text(C.errorCode, { enum: agentsErrorCodes }),
  errorMessage: text(C.errorMessage),
  createdAt: createdAt(),
  endedAt: integer(C.endedAt),
  closedAt: integer(C.closedAt),
  lastFocusedAt: integer(C.lastFocusedAt),
})
export type SessionRow = typeof agentsSessions.$inferSelect
