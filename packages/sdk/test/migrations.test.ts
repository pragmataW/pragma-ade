import { join } from 'node:path'
import { afterEach, expect, it, test } from 'vitest'
import { openDatabase } from '../src/runtime/main/database'
import { applyMigrations, InvalidMigrationNameError, type ModuleMigrations } from '../src/runtime/main/migrations'
import { tempDir } from './lib/builders'

const handles: { close(): void }[] = []
afterEach(() => {
  for (const h of handles.splice(0)) h.close()
})
const freshDb = (file = join(tempDir(), 'app.db')) => {
  const h = openDatabase(file)
  handles.push(h)
  return h.sqlite
}
const create = (table: string) => `CREATE TABLE ${table} (id INTEGER PRIMARY KEY);`
const mod = (module: string, migrations: [string, string][]): ModuleMigrations => ({
  module,
  migrations: migrations.map(([name, sql]) => ({ name, sql })),
})
const tables = (sqlite: ReturnType<typeof freshDb>) =>
  (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map(
    (r) => r.name,
  )

test('modules apply in the given (dependsOn) order even when names would sort otherwise', () => {
  const sqlite = freshDb()
  const result = applyMigrations(sqlite, [
    mod('a', [['0005_a.sql', create('a_items')]]),
    mod('b', [['0001_b.sql', 'CREATE TABLE b_items (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a_items(id));']]),
  ])
  expect(result.applied).toEqual([
    { module: 'a', name: '0005_a.sql' },
    { module: 'b', name: '0001_b.sql' },
  ])
})
test('names sort within a module', () => {
  const result = applyMigrations(freshDb(), [
    mod('a', [
      ['0002_more.sql', 'ALTER TABLE a_items ADD COLUMN x TEXT;'],
      ['0001_init.sql', create('a_items')],
    ]),
  ])
  expect(result.applied.map((m) => m.name)).toEqual(['0001_init.sql', '0002_more.sql'])
})
test('same migration name in two modules is fine', () => {
  const result = applyMigrations(freshDb(), [
    mod('a', [['0001_init.sql', create('a_items')]]),
    mod('b', [['0001_init.sql', create('b_items')]]),
  ])
  expect(result.applied).toHaveLength(2)
  expect(result.failed).toBeUndefined()
})
test('second run applies nothing', () => {
  const file = join(tempDir(), 'app.db')
  const plan = [mod('a', [['0001_init.sql', create('a_items')]])]
  expect(applyMigrations(freshDb(file), plan).applied).toHaveLength(1)
  expect(applyMigrations(freshDb(file), plan).applied).toEqual([])
})
test('failure rolls back and reports; earlier ones stay', () => {
  const sqlite = freshDb()
  const result = applyMigrations(sqlite, [
    mod('a', [
      ['0001_ok.sql', create('a_items')],
      ['0002_bad.sql', `${create('a_half')} SELECT * FROM missing_table;`],
      ['0003_never.sql', create('a_never')],
    ]),
  ])
  expect(result.applied).toEqual([{ module: 'a', name: '0001_ok.sql' }])
  expect(result.failed).toMatchObject({ module: 'a', name: '0002_bad.sql' })
  expect(tables(sqlite)).toEqual(['a_items', 'schema_migrations'])
})
test('skipModules', () => {
  const result = applyMigrations(freshDb(), [mod('a', [['0001_init.sql', create('a_items')]])], {
    skipModules: new Set(['a']),
  })
  expect(result.applied).toEqual([])
})
it.each(['1_init.sql', '0001-init.sql', '0001_Init.sql', '0001_init.txt'])('invalid name %s is rejected', (name) => {
  expect(() => applyMigrations(freshDb(), [mod('a', [[name, create('a_items')]])])).toThrow(InvalidMigrationNameError)
})
