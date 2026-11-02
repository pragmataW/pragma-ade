import { join } from 'node:path'
import { applyMigrations, type OpenedDatabase, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { afterEach } from 'vitest'

const MODULE_DIR = join(import.meta.dirname, '..', '..')
const DB_FILE = 'board.db'

export interface TestDb {
  opened: OpenedDatabase
  file: string
  /** Closes the connection and opens the same file again (migrations are recorded, so none re-run). */
  reopen(): Promise<OpenedDatabase>
}

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

async function migrate(file: string): Promise<OpenedDatabase> {
  const record = await loadModuleRecord(MODULE_DIR)
  const opened = openDatabase(file)
  const applied = applyMigrations(opened.sqlite, [{ module: record.manifest.id, migrations: record.migrations }])
  if (applied.failed) throw applied.failed.error
  return opened
}

/** A temp SQLite file with this module's migrations, closed and removed after the test. */
export async function openTestDb(): Promise<TestDb> {
  const dir = createTempUserData()
  const file = join(dir.path, DB_FILE)
  const state: TestDb = {
    opened: await migrate(file),
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
