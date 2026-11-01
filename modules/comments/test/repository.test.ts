import { describe, expect, it } from 'vitest'
import { CommentInputSchema } from '../src/contract'
import { createCommentsRepository, type NewCommentRow } from '../src/main/repository'
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
    expect([c.status, c.createdAt, c.updatedAt, c.sentAt, c.targetSessionId]).toEqual(['draft', 5, 5, null, null])
    expect(c.filePath).toBe('src/example.ts')
  })

  it('element round-trips through element_json', () => {
    const element = makeElement({ consoleErrors: ['boom'], component: { name: 'X' } })
    const input = CommentInputSchema.parse(makeBrowserInput({ element }))
    const c = repo().insert({ ...input, createdAt: 1 })
    expect(repo().get(c.id)?.element).toEqual(element)
    expect(c.filePath).toBeUndefined()
  })

  it('list drafts: createdAt asc, sent excluded', () => {
    const r = repo()
    const late = r.insert(row(3))
    const early = r.insert(row(1))
    const sent = r.insert(row(2))
    r.markSent([sent.id], 's1', 10)
    expect(r.list(WT, 'draft').map((c) => c.id)).toEqual([early.id, late.id])
  })

  it('list sent: sentAt desc, limit honoured', () => {
    const r = repo()
    const ids = [1, 2, 3].map((n) => r.insert(row(n)).id)
    ids.forEach((id, i) => {
      r.markSent([id], 's1', 100 + i)
    })
    expect(r.list(WT, 'sent', 2).map((c) => c.id)).toEqual([ids[2], ids[1]])
  })

  it('update returns undefined for a sent comment and leaves it unchanged', () => {
    const r = repo()
    const c = r.insert(row(1))
    expect(r.update(c.id, { body: 'new' }, 2)?.body).toBe('new')
    r.markSent([c.id], 's1', 3)
    expect(r.update(c.id, { body: 'again' }, 4)).toBeUndefined()
    expect(r.get(c.id)?.body).toBe('new')
  })

  it('markSent touches only the given ids', () => {
    const r = repo()
    const [a, b] = [r.insert(row(1)), r.insert(row(2))]
    r.markSent([a.id], 'sess', 9)
    expect(r.get(a.id)).toMatchObject({ status: 'sent', targetSessionId: 'sess', sentAt: 9 })
    expect(r.get(b.id)).toMatchObject({ status: 'draft', targetSessionId: null, sentAt: null })
  })

  it('removeByWorktree removes only that worktree and returns the count', () => {
    const r = repo()
    r.insert(row(1))
    r.insert(row(2))
    const other = r.insert(row(3, { worktreeId: OTHER_WT }))
    expect(r.removeByWorktree(WT)).toBe(2)
    expect(r.getMany([other.id])).toHaveLength(1)
  })

  it('the migration is recorded once in schema_migrations', () => {
    const rows = db().sqlite.prepare('SELECT name FROM schema_migrations WHERE module = ?').all('comments') as {
      name: string
    }[]
    expect(rows).toEqual([{ name: '0501_comments_review_comments.sql' }])
  })
})
