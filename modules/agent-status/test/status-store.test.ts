import { describe, expect, it } from 'vitest'
import { event } from './support/builders'
import { storeHarness, TIMINGS } from './support/fakes'

const tracked = (source: 'hooks' | 'external' | 'pending-hooks' = 'hooks', worktreeId = 'w1') => {
  const h = storeHarness()
  const t = h.store.track({ sessionId: 's1', worktreeId, source })
  return { h, t }
}

describe('StatusStore', () => {
  it('writes status + externalSessionId via updateSession', async () => {
    const { h, t } = tracked()
    t.applyEvent(event('promptSubmitted', { externalSessionId: 'ext1' }))
    await h.store.flush()
    expect(h.agents.updates).toEqual([['s1', { status: 'working', externalSessionId: 'ext1' }]])
  })

  it('emits agentSession.statusChanged', () => {
    const { h, t } = tracked()
    t.applyEvent(event('waitingForUser'))
    expect(h.emitted).toEqual([{ sessionId: 's1', status: 'waiting' }])
  })

  it('publishes session + worktree infos', () => {
    const { h, t } = tracked()
    t.applyEvent(event('toolStarted', { toolName: 'Bash' }))
    expect(h.sessions.at(-1)).toMatchObject({ sessionId: 's1', status: 'working', detail: 'Bash', source: 'hooks' })
    expect(h.worktrees.at(-1)).toMatchObject({ worktreeId: 'w1', status: 'working', sessionCount: 1 })
  })

  it('unread for unselected worktree, cleared by markWorktreeRead', () => {
    const { h, t } = tracked()
    t.applyEvent(event('promptSubmitted'))
    t.applyEvent(event('turnCompleted'))
    expect(h.store.info('s1')?.unread).toBe(true)
    expect(h.store.worktree('w1').unreadCount).toBe(1)
    h.store.markWorktreeRead('w1')
    expect(h.store.info('s1')?.unread).toBe(false)
    expect(h.worktrees.at(-1)?.unreadCount).toBe(0)
  })

  it('no unread when the worktree is selected', () => {
    const { h, t } = tracked()
    h.setActive('w1')
    t.applyEvent(event('waitingForUser'))
    expect(h.store.info('s1')?.unread).toBe(false)
  })

  it('updateSession rejection logged, next update still sent', async () => {
    const { h, t } = tracked()
    h.agents.failNextUpdate()
    t.applyEvent(event('promptSubmitted'))
    t.applyEvent(event('waitingForUser'))
    await h.store.flush()
    expect(h.log.messages('warn')).toHaveLength(1)
    expect(h.agents.updates).toEqual([['s1', { status: 'waiting' }]])
  })

  it('updates serialized in order', async () => {
    const { h, t } = tracked()
    t.applyEvent(event('promptSubmitted'))
    t.applyEvent(event('waitingForUser'))
    t.applyEvent(event('userResponded'))
    t.applyEvent(event('turnCompleted'))
    await h.store.flush()
    expect(h.agents.updates.map(([, p]) => p.status)).toEqual(['working', 'waiting', 'working', 'idle'])
  })

  it('grace expiry logs one warning', () => {
    const { h } = tracked('pending-hooks')
    h.clock.advance(TIMINGS.hookGraceMs * 3)
    expect(h.log.messages('warn')).toEqual([
      'no status hooks received within 30000 ms for session s1; using terminal activity',
    ])
  })

  it('external source never calls updateSession but still emits, publishes and marks unread', async () => {
    const { h, t } = tracked('external')
    t.applyEvent(event('waitingForUser'))
    await h.store.flush()
    expect(h.agents.updates).toEqual([])
    expect(h.emitted).toHaveLength(1)
    expect(h.sessions.at(-1)).toMatchObject({ status: 'waiting', unread: true })
  })

  it('exit is announced but not written (03 owns it); a relaunch tracks afresh', async () => {
    const { h, t } = tracked()
    t.applyEvent(event('promptSubmitted'))
    h.store.exited('s1')
    await h.store.flush()
    expect(h.agents.updates.map(([, p]) => p.status)).toEqual(['working'])
    expect(h.emitted.at(-1)).toEqual({ sessionId: 's1', status: 'exited' })
    const again = h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'hooks' })
    expect(again.state.status).toBe('starting')
  })

  it('a failed turn is written as idle: the agent still runs, its row must not read "failed to start"', async () => {
    const { h, t } = tracked()
    t.applyEvent(event('promptSubmitted'))
    t.applyEvent(event('turnFailed', { message: 'rate_limit' }))
    await h.store.flush()
    expect(h.agents.updates.map(([, p]) => p.status)).toEqual(['working', 'idle'])
    expect(h.emitted.at(-1)).toEqual({ sessionId: 's1', status: 'error' })
    expect(h.store.info('s1')).toMatchObject({ status: 'error', detail: 'rate_limit' })
  })

  it('a failed turn is logged with its detail', () => {
    const { h, t } = tracked()
    t.applyEvent(event('turnFailed', { message: 'authentication_failed' }))
    t.applyEvent(event('turnFailed', { message: 'authentication_failed' }))
    expect(h.log.messages('warn')).toEqual(['session s1: the agent turn failed (authentication_failed)'])
  })

  it('forget drops a closed session', () => {
    const { h } = tracked()
    h.store.forget('s1')
    expect(h.store.info('s1')).toBeNull()
    expect(h.worktrees.at(-1)).toMatchObject({ worktreeId: 'w1', sessionCount: 0, status: null })
  })
})
