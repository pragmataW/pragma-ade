import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { eq, integer, sqliteTable, text } from '../src/db/index'
import { openDatabase } from '../src/runtime/main/database'
import { tempDir } from './lib/builders'

const items = sqliteTable('demo_items', { id: integer('id').primaryKey(), label: text('label').notNull() })
const open: { close(): void }[] = []
afterEach(() => {
  for (const d of open.splice(0)) d.close()
})
const openTemp = () => {
  const d = openDatabase(join(tempDir(), 'app.db'))
  open.push(d)
  return d
}

test('enables WAL and foreign keys', () => {
  const { sqlite } = openTemp()
  expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
  expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000)
})
test('drizzle select on a @pragma/sdk/db table', () => {
  const { sqlite, db } = openTemp()
  sqlite.exec('CREATE TABLE demo_items (id INTEGER PRIMARY KEY, label TEXT NOT NULL)')
  db.insert(items)
    .values([{ label: 'a' }, { label: 'b' }])
    .run()
  expect(db.select().from(items).where(eq(items.label, 'b')).all()).toEqual([{ id: 2, label: 'b' }])
})
