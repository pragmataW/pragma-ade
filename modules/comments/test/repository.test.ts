import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { describe, expect, it } from 'vitest'
import { CommentInputSchema } from '../src/contract'
import { createCommentsRepository, type NewCommentRow } from '../src/main/repository'
import { COMMENTS_TABLE } from '../src/main/schema'
import { perTestDb } from './db'
import { makeBrowserInput, makeElement, makeInput, OTHER_WT, WT } from './factories'

const db = perTestDb()
const repo = () => createCommentsRepository(db().db)
const row = (createdAt: number, o: Parameters<typeof makeInput>[0] = {}): NewCommentRow => {
  const { worktreeId, ...rest } = CommentInputSchema.parse(makeInput(o))
  return { ...rest, worktreeId, createdAt }
}

describe('CommentsRepository', () => {
  it('insert returns a draft with uuid and createdAt === updatedAt', () => {
    const c = repo().insert(row(5))
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/)
    expect([c.createdAt, c.updatedAt]).toEqual([5, 5])
    expect(c.filePath).toBe('src/example.ts')
  })

  it('element round-trips through element_json', () => {
    const element = makeElement({ consoleErrors: ['boom'], component: { name: 'X' } })
    const input = CommentInputSchema.parse(makeBrowserInput({ element }))
    const c = repo().insert({ ...input, createdAt: 1 })
    expect(repo().get(c.id)?.element).toEqual(element)
    expect(c.filePath).toBeUndefined()
  })

  it('list: createdAt asc, only that worktree', () => {
    const r = repo()
    const late = r.insert(row(3))
    const early = r.insert(row(1))
    r.insert(row(2, { worktreeId: OTHER_WT }))
    expect(r.list(WT).map((c) => c.id)).toEqual([early.id, late.id])
  })

  it('update patches and bumps updatedAt; a missing id returns undefined', () => {
    const r = repo()
    const c = r.insert(row(1))
    expect(r.update(c.id, { body: 'new' }, 2)).toMatchObject({ body: 'new', updatedAt: 2 })
    expect(r.update('missing', { body: 'x' }, 3)).toBeUndefined()
  })

  it('removeMany deletes only the given ids and returns the count', () => {
    const r = repo()
    const [a, b] = [r.insert(row(1)), r.insert(row(2))]
    expect(r.removeMany([a.id, 'missing'])).toBe(1)
    expect(r.removeMany([])).toBe(0)
    expect(r.list(WT).map((c) => c.id)).toEqual([b.id])
  })

  it('removeByWorktree removes only that worktree and returns the count', () => {
    const r = repo()
    r.insert(row(1))
    r.insert(row(2))
    const other = r.insert(row(3, { worktreeId: OTHER_WT }))
    expect(r.removeByWorktree(WT)).toBe(2)
    expect(r.getMany([other.id])).toHaveLength(1)
  })

  it('the migrations are recorded once in schema_migrations, in order', () => {
    const rows = db().sqlite.prepare('SELECT name FROM schema_migrations WHERE module = ?').all('comments') as {
      name: string
    }[]
    expect(rows).toEqual([{ name: '0501_comments_review_comments.sql' }, { name: '0502_comments_drop_sent.sql' }])
  })
})

describe('0502_comments_drop_sent', () => {
  it('an upgraded database loses its sent rows and the sent-only columns; drafts survive', async () => {
    const { migrations } = await loadModuleRecord(join(import.meta.dirname, '..'))
    const dir = createTempUserData()
    const { sqlite, close } = openDatabase(join(dir.path, 'upgrade.db'))
    try {
      const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
      const upTo = (n: number) => [{ module: 'comments', migrations: sorted.slice(0, n) }]
      expect(applyMigrations(sqlite, upTo(1)).failed).toBeUndefined()
      sqlite.exec(`INSERT INTO ${COMMENTS_TABLE} (id, worktree_id, source, file_path, body, status, created_at, updated_at, sent_at)
        VALUES ('d', 'w', 'diff', 'a.ts', 'keep', 'draft', 1, 1, NULL), ('s', 'w', 'diff', 'a.ts', 'gone', 'sent', 2, 3, 3)`)
      expect(applyMigrations(sqlite, upTo(2)).failed).toBeUndefined()
      expect(sqlite.prepare(`SELECT id FROM ${COMMENTS_TABLE}`).all()).toEqual([{ id: 'd' }])
      const cols = (sqlite.prepare(`PRAGMA table_info(${COMMENTS_TABLE})`).all() as { name: string }[]).map(
        (c) => c.name,
      )
      for (const gone of ['status', 'target_session_id', 'sent_at']) expect(cols).not.toContain(gone)
    } finally {
      close()
      dir.cleanup()
    }
  })
})
