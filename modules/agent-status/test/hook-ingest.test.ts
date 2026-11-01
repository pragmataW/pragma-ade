import { describe, expect, it } from 'vitest'
import type { StatusCapability } from '../src/contract'
import { createHookEventHandler } from '../src/main/hook-ingest'
import { fakeStatusCapability, storeHarness } from './support/fakes'

const ctx = { clientId: 'http:1', transport: 'http' as const }

function ingest(cap: StatusCapability | undefined = fakeStatusCapability().cap) {
  const h = storeHarness()
  const seen: string[] = []
  const handler = createHookEventHandler({
    store: h.store,
    agents: h.agents,
    statusCapability: (id) => {
      seen.push(id)
      return cap
    },
    log: h.log,
  })
  const send = (event: unknown, sessionId = 's1') =>
    handler.hookEvent({ sessionId, providerId: 'evil', event }, ctx) as Promise<{ accepted: boolean }>
  return { h, send, seen }
}

describe('hook ingest', () => {
  it("parses via the session's provider and moves to working", async () => {
    const { h, send, seen } = ingest()
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'pending-hooks' })
    expect(await send({ kind: 'promptSubmitted' })).toEqual({ accepted: true })
    expect(seen).toEqual(['prov'])
    expect(h.store.info('s1')).toMatchObject({ status: 'working', source: 'hooks' })
  })

  it('unknown session → accepted false', async () => {
    const { send } = ingest()
    expect(await send({ kind: 'promptSubmitted' }, 'nope')).toEqual({ accepted: false })
  })

  it('ignores events for exited session', async () => {
    const { h, send } = ingest()
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'hooks' })
    h.store.exited('s1')
    expect(await send({ kind: 'sessionEnded' })).toEqual({ accepted: false })
    expect(h.store.info('s1')?.status).toBe('exited')
  })

  it('parseEvent null → accepted true, no change', async () => {
    const { h, send } = ingest()
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'pending-hooks' })
    expect(await send('noise')).toEqual({ accepted: true })
    expect(h.store.info('s1')).toMatchObject({ status: 'starting', source: 'pending-hooks' })
  })

  it('invalid capability result → accepted false + warning', async () => {
    const { cap } = fakeStatusCapability({ parseEvent: () => ({ kind: 'bogus' }) as never })
    const { h, send } = ingest(cap)
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'pending-hooks' })
    expect(await send({})).toEqual({ accepted: false })
    expect(h.log.messages('warn')).toHaveLength(1)
  })
})
