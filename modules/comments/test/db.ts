import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { afterEach, beforeEach } from 'vitest'

const MODULE_DIR = join(import.meta.dirname, '..')

/** A migrated temp SQLite database per test (the host's own migration runner). */
export function perTestDb() {
  let state: { opened: ReturnType<typeof openDatabase>; done: () => void } | undefined
  beforeEach(async () => {
    const record = await loadModuleRecord(MODULE_DIR)
    const dir = createTempUserData()
    const opened = openDatabase(join(dir.path, 'comments.db'))
    const applied = applyMigrations(opened.sqlite, [{ module: record.manifest.id, migrations: record.migrations }])
    if (applied.failed) throw applied.failed.error
    state = {
      opened,
      done: () => {
        opened.close()
        dir.cleanup()
      },
    }
  })
  afterEach(() => state?.done())
  return () => {
    if (!state) throw new Error('perTestDb: used outside a test')
    return state.opened
  }
}
