import { join } from 'node:path'
import { applyMigrations, type OpenedDatabase, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { afterEach } from 'vitest'

const MODULE_DIR = join(import.meta.dirname, '..', '..')
const DB_FILE = 'board.db'

export interface TestDb {
  opened: OpenedDatabase
  file: string
  /** Closes the connection and opens the same file again with every migration (recorded ones do not re-run). */
  reopen(): Promise<OpenedDatabase>
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

/** Applies the first `count` migrations (by name), or all of them. */
async function migrate(file: string, count?: number): Promise<OpenedDatabase> {
  const record = await loadModuleRecord(MODULE_DIR)
  const migrations = [...record.migrations].sort((a, b) => a.name.localeCompare(b.name)).slice(0, count)
  const opened = openDatabase(file)
  const applied = applyMigrations(opened.sqlite, [{ module: record.manifest.id, migrations }])
  if (applied.failed) throw applied.failed.error
  return opened
}

/**
 * A temp SQLite file with this module's migrations, closed and removed after the test.
 * `migrations` limits the first open to the oldest N, so `reopen()` exercises the upgrade path.
 */
export async function openTestDb(opts: { migrations?: number } = {}): Promise<TestDb> {
  const dir = createTempUserData()
  const file = join(dir.path, DB_FILE)
  const state: TestDb = {
    opened: await migrate(file, opts.migrations),
    file,
    async reopen() {
      state.opened.close()
      state.opened = await migrate(file)
      return state.opened
    },
  }
  cleanups.push(() => {
    state.opened.close()
    dir.cleanup()
  })
  return state
}
