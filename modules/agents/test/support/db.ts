import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { afterEach, beforeEach } from 'vitest'

export const MODULE_DIR = join(import.meta.dirname, '..', '..')

/** A temp SQLite file with this module's migrations applied by the host's runner. */
export async function makeTestDb() {
  const { manifest, migrations } = await loadModuleRecord(MODULE_DIR)
  const temp = createTempUserData()
  const opened = openDatabase(join(temp.path, 'agents.db'))
  const result = applyMigrations(opened.sqlite, [{ module: manifest.id, migrations }])
  if (result.failed) throw result.failed.error
  return {
    ...opened,
    dir: temp.path,
    cleanup() {
      opened.close()
      temp.cleanup()
    },
  }
}
export type TestDb = Awaited<ReturnType<typeof makeTestDb>>

/** A fresh migrated DB for every test. */
export function perTestDb(): () => TestDb {
  let current: TestDb | undefined
  beforeEach(async () => {
    current = await makeTestDb()
  })
  afterEach(() => {
    current?.cleanup()
    current = undefined
  })
  return () => {
    if (!current) throw new Error('perTestDb: no database outside a test')
    return current
  }
}
