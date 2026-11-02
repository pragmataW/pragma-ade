import { describe, expect, it, vi } from 'vitest'
import type { StatusCapability, StatusMonitorContext } from '../src/contract'
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

  it('creates the provider monitor once, shows it every payload (also unparsed ones) after applying it', async () => {
    let report: StatusMonitorContext['report'] = () => undefined
    const seen: [unknown, unknown, string | undefined][] = []
    const created = vi.fn()
    const { cap } = fakeStatusCapability({
      monitorSession(ctx) {
        created()
        report = ctx.report
        return { onHookEvent: (raw, parsed) => void seen.push([raw, parsed, h.store.info('s1')?.status]), dispose() {} }
      },
    })
    const { h, send } = ingest(cap)
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'pending-hooks' })
    await send({ kind: 'promptSubmitted' })
    await send('noise')
    expect(created).toHaveBeenCalledTimes(1)
    expect(seen).toEqual([
      [{ kind: 'promptSubmitted' }, { kind: 'promptSubmitted' }, 'working'],
      ['noise', null, 'working'],
    ])

    report({ kind: 'bogus' } as never)
    expect(h.log.messages('warn')).toHaveLength(1)
    expect(h.store.info('s1')?.status).toBe('working')
    report({ kind: 'turnInterrupted' })
    expect(h.store.info('s1')).toMatchObject({ status: 'idle', turnCompleted: false })

    h.store.exited('s1')
    report({ kind: 'promptSubmitted' })
    expect(h.store.info('s1')?.status).toBe('exited')
  })

  it('invalid capability result → accepted false + warning', async () => {
    const { cap } = fakeStatusCapability({ parseEvent: () => ({ kind: 'bogus' }) as never })
    const { h, send } = ingest(cap)
    h.store.track({ sessionId: 's1', worktreeId: 'w1', source: 'pending-hooks' })
    expect(await send({})).toEqual({ accepted: false })
    expect(h.log.messages('warn')).toHaveLength(1)
  })
})
