import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData, loadModuleRecord } from '@pragma/test-support'
import { describe, expect, it } from 'vitest'
import { CommentInputSchema } from '../src/contract'
import { createCommentsRepository, type NewCommentRow, type NewReplyRow } from '../src/main/repository'
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
  it('insert returns an open, pending thread with uuid and createdAt === updatedAt', () => {
    const c = repo().insert(row(5))
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/)
    expect([c.createdAt, c.updatedAt]).toEqual([5, 5])
    expect(c.filePath).toBe('src/example.ts')
    expect(c).toMatchObject({ status: 'open', replies: [] })
    expect(c.round).toBeUndefined()
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

  it('removeByWorktree removes only that worktree and returns the count', () => {
    const r = repo()
    r.insert(row(1))
    r.insert(row(2))
    const other = r.insert(row(3, { worktreeId: OTHER_WT }))
    expect(r.removeByWorktree(WT)).toBe(2)
    expect(r.getMany([other.id])).toHaveLength(1)
  })

  it('removeByWorktree also resets the round counter', () => {
    const r = repo()
    const c = r.insert(row(1))
    expect(r.markDelivered(WT, { commentIds: [c.id], replyIds: [] }, 2)).toBe(1)
    r.removeByWorktree(WT)
    expect(r.currentRound(WT)).toBe(0)
  })

  it('the migrations are recorded once in schema_migrations, in order', () => {
    const rows = db().sqlite.prepare('SELECT name FROM schema_migrations WHERE module = ?').all('comments') as {
      name: string
    }[]
    expect(rows).toEqual([
      { name: '0501_comments_review_comments.sql' },
      { name: '0502_comments_drop_sent.sql' },
      { name: '0503_comments_threads.sql' },
    ])
  })
})

describe('threads', () => {
  const reply = (commentId: string, createdAt: number, o: Partial<NewReplyRow> = {}): NewReplyRow => ({
    commentId,
    author: 'user',
    body: `reply ${createdAt}`,
    createdAt,
    ...o,
  })

  it('insertReply / list: replies ordered by createdAt, agent fields round-trip', () => {
    const r = repo()
    const c = r.insert(row(1))
    const late = r.insertReply(reply(c.id, 5))
    const early = r.insertReply(reply(c.id, 3, { author: 'agent', sessionId: 's1', authorLabel: 'Claude', round: 1 }))
    const [thread] = r.list(WT)
    expect(thread?.replies.map((x) => x.id)).toEqual([early.id, late.id])
    expect(thread?.replies[0]).toMatchObject({ author: 'agent', sessionId: 's1', authorLabel: 'Claude', round: 1 })
    expect(thread?.replies[1]?.round).toBeUndefined()
    expect(r.getReply(late.id)).toEqual(late)
  })

  it('deleting a root cascades to its replies', () => {
    const r = repo()
    const c = r.insert(row(1))
    const x = r.insertReply(reply(c.id, 2))
    r.remove(c.id)
    expect(r.getReply(x.id)).toBeUndefined()
  })

  it('removeReply deletes one reply', () => {
    const r = repo()
    const c = r.insert(row(1))
    const x = r.insertReply(reply(c.id, 2))
    expect(r.removeReply(x.id)).toBe(true)
    expect(r.removeReply(x.id)).toBe(false)
    expect(r.get(c.id)?.replies).toEqual([])
  })

  it('setStatus resolves (resolvedAt) and reopens; list filters by status', () => {
    const r = repo()
    const [a, b] = [r.insert(row(1)), r.insert(row(2))]
    expect(r.setStatus(a.id, 'resolved', 9)).toMatchObject({ status: 'resolved', resolvedAt: 9 })
    expect(r.list(WT, 'open').map((c) => c.id)).toEqual([b.id])
    expect(r.list(WT, 'resolved').map((c) => c.id)).toEqual([a.id])
    expect(r.list(WT, 'all')).toHaveLength(2)
    const reopened = r.setStatus(a.id, 'open', 10)
    expect(reopened?.status).toBe('open')
    expect(reopened?.resolvedAt).toBeUndefined()
    expect(r.setStatus('missing', 'open', 1)).toBeUndefined()
  })

  it('markDelivered stamps only the given pending ids with round 1, then 2', () => {
    const r = repo()
    const [a, b] = [r.insert(row(1)), r.insert(row(2))]
    const x = r.insertReply(reply(a.id, 3))
    expect(r.currentRound(WT)).toBe(0)
    expect(r.markDelivered(WT, { commentIds: [a.id], replyIds: [x.id] }, 4)).toBe(1)
    expect(r.get(a.id)?.round).toBe(1)
    expect(r.get(a.id)?.replies[0]?.round).toBe(1)
    expect(r.get(b.id)?.round).toBeUndefined()
    expect(r.markDelivered(WT, { commentIds: [a.id, b.id], replyIds: [] }, 5)).toBe(2)
    expect([r.get(a.id)?.round, r.get(b.id)?.round]).toEqual([1, 2])
    expect(r.currentRound(WT)).toBe(2)
    expect(r.currentRound(OTHER_WT)).toBe(0)
  })

  it('markDelivered reopens a resolved thread that gets a user reply', () => {
    const r = repo()
    const c = r.insert(row(1))
    r.markDelivered(WT, { commentIds: [c.id], replyIds: [] }, 2)
    r.setStatus(c.id, 'resolved', 3)
    const x = r.insertReply(reply(c.id, 4))
    r.markDelivered(WT, { commentIds: [], replyIds: [x.id] }, 5)
    expect(r.get(c.id)).toMatchObject({ status: 'open' })
  })

  it("clearResolved deletes only the worktree's resolved threads and returns their ids", () => {
    const r = repo()
    const [a, b] = [r.insert(row(1)), r.insert(row(2))]
    const other = r.insert(row(3, { worktreeId: OTHER_WT }))
    r.setStatus(a.id, 'resolved', 4)
    r.setStatus(other.id, 'resolved', 4)
    expect(r.clearResolved(WT)).toEqual([a.id])
    expect(r.list(WT).map((c) => c.id)).toEqual([b.id])
    expect(r.get(other.id)).toBeDefined()
  })
})

describe('0503_comments_threads', () => {
  it('an old row becomes an open, pending thread without replies', async () => {
    const { migrations } = await loadModuleRecord(join(import.meta.dirname, '..'))
    const dir = createTempUserData()
    const { sqlite, db: drizzle, close } = openDatabase(join(dir.path, 'upgrade.db'))
    try {
      const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
      const upTo = (n: number) => [{ module: 'comments', migrations: sorted.slice(0, n) }]
      expect(applyMigrations(sqlite, upTo(2)).failed).toBeUndefined()
      sqlite.exec(`INSERT INTO ${COMMENTS_TABLE} (id, worktree_id, source, file_path, body, created_at, updated_at)
        VALUES ('d', 'w', 'diff', 'a.ts', 'keep', 1, 1)`)
      expect(applyMigrations(sqlite, upTo(3)).failed).toBeUndefined()
      const c = createCommentsRepository(drizzle).get('d')
      expect(c).toMatchObject({ id: 'd', status: 'open', replies: [] })
      expect(c?.round).toBeUndefined()
    } finally {
      close()
      dir.cleanup()
    }
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
