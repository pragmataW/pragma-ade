import { MIGRATION_NAME_PATTERN } from '../../common/patterns'
import type { SqliteDatabase } from './database'

export interface ModuleMigrations {
  module: string
  migrations: { name: string; sql: string }[]
}

export interface MigrationRef {
  module: string
  name: string
}

export interface MigrationResult {
  applied: MigrationRef[]
  failed?: MigrationRef & { error: unknown }
}

export class InvalidMigrationNameError extends Error {}

const BOOKKEEPING = `CREATE TABLE IF NOT EXISTS schema_migrations (
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (module, name)
)`

function assertNames(ordered: readonly ModuleMigrations[]): void {
  for (const m of ordered)
    for (const { name } of m.migrations)
      if (!MIGRATION_NAME_PATTERN.test(name))
        throw new InvalidMigrationNameError(`module ${m.module}: invalid migration name "${name}" (NNNN_name.sql)`)
}

/**
 * Applies migrations module by module in the given (dependsOn topological) order; names order only within a module
 * (§10.1.4). Each migration runs in its own transaction with its bookkeeping row; the first failure stops the run.
 */
export function applyMigrations(
  sqlite: SqliteDatabase,
  ordered: readonly ModuleMigrations[],
  opts: { skipModules?: ReadonlySet<string> } = {},
): MigrationResult {
  assertNames(ordered)
  sqlite.exec(BOOKKEEPING)
  const done = sqlite.prepare('SELECT 1 FROM schema_migrations WHERE module = ? AND name = ?')
  const record = sqlite.prepare('INSERT INTO schema_migrations (module, name, applied_at) VALUES (?, ?, ?)')
  const applied: MigrationRef[] = []
  for (const m of ordered) {
    if (opts.skipModules?.has(m.module)) continue
    const pending = [...m.migrations].sort((a, b) => a.name.localeCompare(b.name))
    for (const { name, sql } of pending) {
      if (done.get(m.module, name)) continue
      try {
        sqlite.transaction(() => {
          sqlite.exec(sql)
          record.run(m.module, name, Date.now())
        })()
      } catch (error) {
        return { applied, failed: { module: m.module, name, error } }
      }
      applied.push({ module: m.module, name })
    }
  }
  return { applied }
}
