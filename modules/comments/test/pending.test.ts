import type { AgentSessionStartedPayload } from '@pragma/module-agents/contract'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { COMMENTS_IPC_EVENTS, type SendResult } from '../src/contract'
import { DeliveryRegistry } from '../src/main/delivery-registry'
import { PendingDeliveries } from '../src/main/pending'
import { createCommentsRepository } from '../src/main/repository'
import { createCommentsService } from '../src/main/service'
import { perTestDb } from './db'
import { makeInput, makeSession, OTHER_WT, WT } from './factories'
import { createFakeUpstream } from './fakes'

const OPTS = { readyQuietMs: 500, readyTimeoutMs: 15_000, ttlMs: 600_000 }
const SENT: SendResult = { status: 'sent', sessionId: 'new', commentIds: ['c1'], sentAt: 1 }

const started = (o: Partial<AgentSessionStartedPayload> = {}): AgentSessionStartedPayload => ({
  sessionId: 'new',
  worktreeId: WT,
  profileId: 'p1',
  providerId: 'custom',
  mode: 'terminal',
  ptyId: 'pty-new',
  ...o,
})

function setup() {
  const upstream = createFakeUpstream()
  const sends: [string[], string | undefined, unknown][] = []
  const delivered: [string, SendResult][] = []
  const pending = new PendingDeliveries(
    upstream,
    async (ids, target, opts) => {
      sends.push([ids, target, opts])
      return SENT
    },
    (wt, r) => void delivered.push([wt, r]),
    OPTS,
  )
  return { upstream, pending, sends, delivered }
}

describe('PendingDeliveries', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('delivers to the session started in the same worktree after output then quiet', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(1000)
    upstream.emitPtyData('pty-new')
    await vi.advanceTimersByTimeAsync(400)
    upstream.emitPtyData('pty-new')
    await vi.advanceTimersByTimeAsync(400)
    expect(sends).toEqual([])
    await vi.advanceTimersByTimeAsync(200)
    expect(sends).toEqual([[['c1'], 'new', { promptUser: false }]])
  })

  test('ignores sessions started in another worktree', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started({ worktreeId: OTHER_WT, sessionId: 'x', ptyId: 'pty-x' }))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sends).toEqual([])
  })

  test('delivers after readyTimeoutMs without output', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(14_900)
    expect(sends).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(sends).toHaveLength(1)
  })

  test('polls getSession when the event has no ptyId', async () => {
    const { upstream, pending, sends } = setup()
    const session = makeSession({ id: 'new', ptyId: null })
    upstream.sessions.push(session)
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started({ ptyId: null }))
    await vi.advanceTimersByTimeAsync(250)
    session.ptyId = 'pty-late'
    await vi.advanceTimersByTimeAsync(150)
    upstream.emitPtyData('pty-late')
    await vi.advanceTimersByTimeAsync(600)
    expect(sends).toHaveLength(1)
  })

  test('expired entry is not delivered', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    await vi.advanceTimersByTimeAsync(OPTS.ttlMs + 1)
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sends).toEqual([])
  })

  test('cancel prevents delivery', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(100)
    pending.cancel(WT)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sends).toEqual([])
  })

  test('second add replaces the first', async () => {
    const { upstream, pending, sends } = setup()
    pending.add(WT, ['c1'])
    pending.add(WT, ['c2', 'c3'])
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sends.map(([ids]) => ids)).toEqual([['c2', 'c3']])
  })

  test('onDelivered receives the SendResult', async () => {
    const { upstream, pending, delivered } = setup()
    pending.add(WT, ['c1'])
    upstream.emitSessionStarted(started())
    await vi.advanceTimersByTimeAsync(20_000)
    expect(delivered).toEqual([[WT, SENT]])
  })
})

describe('service wiring', () => {
  const db = perTestDb()

  test('a pending send delivered to the launched agent deletes the comments', async () => {
    const upstream = createFakeUpstream([makeSession({ id: 'new', ptyId: 'pty-new' })])
    const registry = new DeliveryRegistry()
    const delivered: string[][] = []
    registry.register('terminal', async (req) => void delivered.push(req.comments.map((c) => c.id)))
    const service = createCommentsService({
      repo: createCommentsRepository(db().db),
      upstream,
      registry,
      events: { emit: () => undefined },
      settings: () => ({ submitAfterPaste: false }),
      pendingOptions: { readyTimeoutMs: 1 },
    })
    const c = await service.addDraft(makeInput())
    await service.sendOnNextSession(WT, [c.id])
    upstream.emitSessionStarted(started())
    await vi.waitFor(() => expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.pendingDelivered)).toHaveLength(1))
    expect(delivered).toEqual([[c.id]])
    expect(await service.listDrafts(WT)).toEqual([])
    service.dispose()
  })

  test('worktree.removed deletes that worktree comments and cancels its entry', async () => {
    const upstream = createFakeUpstream([makeSession({ id: 'new', ptyId: 'pty-new' })])
    const service = createCommentsService({
      repo: createCommentsRepository(db().db),
      upstream,
      registry: new DeliveryRegistry(),
      events: { emit: () => undefined },
      settings: () => ({ submitAfterPaste: false }),
      pendingOptions: { readyTimeoutMs: 1 },
    })
    const kept = await service.addDraft(makeInput({ worktreeId: OTHER_WT }))
    const gone = await service.addDraft(makeInput())
    await service.sendOnNextSession(WT, [gone.id])
    upstream.emitWorktreeRemoved(WT)
    upstream.emitSessionStarted(started())
    await new Promise((r) => setTimeout(r, 20))
    expect(await service.listDrafts(WT)).toEqual([])
    expect(await service.listDrafts(OTHER_WT)).toEqual([kept])
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.pendingDelivered)).toEqual([])
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.changed).at(-1)).toEqual({ worktreeId: WT })
    service.dispose()
  })
})
