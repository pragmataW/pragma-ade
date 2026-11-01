import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { COLUMNS as C, EMPTY_ENV_JSON, TABLES } from '../constants'

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
