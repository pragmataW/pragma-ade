import { aSession } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createAgentStatusService } from '../src/main/service'
import { event } from './support/builders'
import { storeHarness } from './support/fakes'

function service() {
  const h = storeHarness({}, [aSession('s1', 1), aSession('chat1', 2, { worktreeId: 'w2', mode: 'chat' })])
  return { h, svc: createAgentStatusService({ store: h.store, agents: h.agents }) }
}

describe('AgentStatusService', () => {
  it('getWorktreeStatus picks waiting over working', () => {
    const { h, svc } = service()
    h.store.track({ sessionId: 'a', worktreeId: 'w1', source: 'hooks' }).applyEvent(event('promptSubmitted'))
    h.store.track({ sessionId: 'b', worktreeId: 'w1', source: 'hooks' }).applyEvent(event('waitingForUser'))
    expect(svc.getWorktreeStatus('w1')).toMatchObject({ worktreeId: 'w1', status: 'waiting', sessionCount: 2 })
    expect(svc.getWorktreeStatus('none')).toMatchObject({ status: null, sessionCount: 0 })
  })

  it('getStatus null for untracked', () => {
    expect(service().svc.getStatus('nope')).toBeNull()
  })

  it('reportEvent tracks an external session and returns true', async () => {
    const { h, svc } = service()
    expect(await svc.reportEvent('chat1', event('promptSubmitted'))).toBe(true)
    expect(svc.getStatus('chat1')).toMatchObject({ worktreeId: 'w2', status: 'working', source: 'external' })
    await h.store.flush()
    expect(h.agents.updates).toEqual([])
  })

  it('reportEvent unknown session → false', async () => {
    expect(await service().svc.reportEvent('ghost', event('promptSubmitted'))).toBe(false)
  })

  it('reportEvent on an exited session → false', async () => {
    const { h, svc } = service()
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'hooks' })
    h.store.exited('s1')
    expect(await svc.reportEvent('s1', event('promptSubmitted'))).toBe(false)
  })

  it('reportEvent invalid event → rejects with a zod error', async () => {
    await expect(service().svc.reportEvent('s1', { kind: 'nope' } as never)).rejects.toMatchObject({ name: 'ZodError' })
  })
})
