import { describe, expect, it } from 'vitest'
import { SessionsStore } from '../../src/main/sessions/sessions-store'
import { storeDeps } from '../support/builders'
import { perTestDb } from '../support/db'

const db = perTestDb()
const newStore = () => new SessionsStore(db().db, storeDeps())
const row = (worktreeId = 'w1', over: { mode?: string; title?: string | null } = {}) => ({
  worktreeId,
  profileId: 'builtin:claude',
  providerId: 'claude',
  mode: 'terminal',
  title: null,
  ...over,
})

describe('SessionsStore', () => {
  it('inserts a starting row with derived fields', () => {
    const r = newStore().insert(row('w1', { title: 'Fix it' }))
    expect(r).toMatchObject({ worktreeId: 'w1', status: 'starting', ordinal: 1, storedTitle: 'Fix it', ptyId: null })
    expect(r).toMatchObject({ exitCode: null, error: null, endedAt: null, closedAt: null, lastFocusedAt: null })
  })

  it('ordinals per worktree', () => {
    const s = newStore()
    const a = s.insert(row('w1'))
    s.update(a.id, { closedAt: 5 })
    expect([s.insert(row('w1')).ordinal, s.insert(row('w2')).ordinal, s.insert(row('w1')).ordinal]).toEqual([2, 1, 3])
  })

  it('listByWorktree hides closed rows unless includeClosed', () => {
    const s = newStore()
    const a = s.insert(row())
    const b = s.insert(row())
    s.update(a.id, { closedAt: 5 })
    expect(s.listByWorktree('w1').map((r) => r.id)).toEqual([b.id])
    expect(s.listByWorktree('w1', { includeClosed: true }).map((r) => r.id)).toEqual([a.id, b.id])
    expect(s.listOpen().map((r) => r.id)).toEqual([b.id])
  })

  it('update writes status, error and timestamps', () => {
    const s = newStore()
    const a = s.insert(row())
    const u = s.update(a.id, { status: 'error', errorCode: 'commandNotFound', errorMessage: 'nope', endedAt: 9 })
    expect(u).toMatchObject({ status: 'error', error: { code: 'commandNotFound', message: 'nope' }, endedAt: 9 })
    expect(s.update(a.id, { errorCode: null, errorMessage: null }).error).toBeNull()
  })

  it('sweepStale marks running rows exited', () => {
    const s = newStore()
    const running = s.insert(row())
    const working = s.insert(row())
    s.update(working.id, { status: 'working', ptyId: 'p', exitCode: 2 })
    const done = s.insert(row())
    s.update(done.id, { status: 'exited', exitCode: 0, endedAt: 3 })
    expect(s.sweepStale().sort()).toEqual([running.id, working.id].sort())
    expect(s.get(working.id)).toMatchObject({ status: 'exited', exitCode: null })
    expect(s.get(working.id)?.endedAt).toBeGreaterThan(0)
    expect(s.get(done.id)).toMatchObject({ exitCode: 0, endedAt: 3 })
  })

  it('lastFocusedRunning prefers max lastFocusedAt, ignores exited/closed, falls back to newest running', () => {
    const s = newStore()
    const a = s.insert(row())
    const b = s.insert(row())
    const c = s.insert(row())
    expect(s.lastFocusedRunning('w1')?.id).toBe(c.id)
    s.update(a.id, { lastFocusedAt: 50 })
    s.update(b.id, { lastFocusedAt: 60, status: 'exited' })
    s.update(c.id, { lastFocusedAt: 70, closedAt: 71 })
    expect(s.lastFocusedRunning('w1')?.id).toBe(a.id)
    expect(s.lastFocusedRunning('w2')).toBeNull()
  })

  it('mode persists and defaults to terminal', () => {
    const chat = newStore().insert(row('w1', { mode: 'chat' }))
    expect(newStore().get(chat.id)?.mode).toBe('chat')
    db().sqlite.exec(
      "INSERT INTO agents_sessions (id, worktree_id, provider_id, ordinal, status, created_at) VALUES ('raw', 'w1', 'x', 9, 'idle', 1)",
    )
    expect(newStore().get('raw')?.mode).toBe('terminal')
  })
})
