import { describe, expect, it, test } from 'vitest'
import { COMMENTS_EVENTS, COMMENTS_IPC_EVENTS, type DeliveryRequest } from '../src/contract'
import { DeliveryRegistry } from '../src/main/delivery-registry'
import { createCommentsRepository } from '../src/main/repository'
import { createCommentsService } from '../src/main/service'
import type { SessionRef } from '../src/main/upstream'
import { perTestDb } from './db'
import { makeInput, makeSession, OTHER_WT, WT } from './factories'
import { createFakeUpstream } from './fakes'

const db = perTestDb()

function setup(sessions: SessionRef[] = [makeSession({ id: 's1' })]) {
  const upstream = createFakeUpstream(sessions)
  const repo = createCommentsRepository(db().db)
  const registry = new DeliveryRegistry()
  const delivered: DeliveryRequest[] = []
  let deliverImpl = async (_req: DeliveryRequest): Promise<void> => undefined
  registry.register('terminal', async (req) => {
    delivered.push(req)
    await deliverImpl(req)
  })
  const emitted: [string, unknown][] = []
  const settings = { submitAfterPaste: false }
  let clock = 1000
  const service = createCommentsService({
    repo,
    upstream,
    registry,
    events: { emit: (def, payload) => void emitted.push([def.name, payload]) },
    settings: () => settings,
    now: () => ++clock,
  })
  const drafts = async (n: number, o: Parameters<typeof makeInput>[0] = {}) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(await service.addDraft(makeInput({ body: `comment ${i + 1}`, ...o })))
    return out
  }
  const ids = (cs: { id: string }[]) => cs.map((c) => c.id)
  return {
    service,
    upstream,
    repo,
    delivered,
    emitted,
    settings,
    drafts,
    ids,
    setDeliver: (fn: typeof deliverImpl) => {
      deliverImpl = fn
    },
  }
}

describe('drafts', () => {
  test('addDraft stores a draft, emits comment.created, publishes comments.changed', async () => {
    const { service, emitted, upstream } = setup()
    const c = await service.addDraft(makeInput())
    expect(emitted).toEqual([[COMMENTS_EVENTS.created, { comment: c }]])
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.changed)).toEqual([{ worktreeId: WT }])
    expect(await service.listDrafts(WT)).toEqual([c])
  })

  test('addDraft rejects invalid input and stores nothing', async () => {
    const { service } = setup()
    await expect(service.addDraft(makeInput({ body: '  ' }))).rejects.toThrow()
    expect(await service.listDrafts(WT)).toEqual([])
  })

  test('update edits a draft; once sent (deleted) update/remove throw notFound', async () => {
    const { service, drafts, ids } = setup()
    const [c] = await drafts(1)
    expect((await service.update(c?.id as string, { body: 'edited' })).body).toBe('edited')
    await service.send(ids(await service.listDrafts(WT)))
    await expect(service.update(c?.id as string, { body: 'x' })).rejects.toMatchObject({ key: 'notFound' })
    await expect(service.remove(c?.id as string)).rejects.toMatchObject({ key: 'notFound' })
    await expect(service.remove('missing')).rejects.toMatchObject({ key: 'notFound' })
  })

  test('remove deletes a draft and publishes comments.changed', async () => {
    const { service, drafts, upstream } = setup()
    const [c] = await drafts(1)
    await service.remove(c?.id as string)
    expect(await service.listDrafts(WT)).toEqual([])
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.changed)).toHaveLength(2)
  })
})

describe('resolveTarget', () => {
  const s = (id: string, o: Partial<SessionRef> = {}) => makeSession({ id, ...o })
  it.each([
    ['none', [], undefined, undefined, { kind: 'none' }],
    ['single', [s('a')], undefined, undefined, { kind: 'single' }],
    ['choose: last focused', [s('a'), s('b')], 'b', undefined, { kind: 'choose', defaultSessionId: 'b' }],
    ['choose: preferred wins', [s('a'), s('b'), s('c')], 'b', 'c', { kind: 'choose', defaultSessionId: 'c' }],
    ['choose: first', [s('a'), s('b')], undefined, undefined, { kind: 'choose', defaultSessionId: 'a' }],
    [
      'exited and closed ignored',
      [s('a', { status: 'exited' }), s('b', { closedAt: 1 }), s('c'), s('d', { worktreeId: OTHER_WT })],
      undefined,
      undefined,
      { kind: 'single', session: { id: 'c' } },
    ],
  ])('%s', async (_n, sessions, lastFocused, preferred, want) => {
    const { service, upstream } = setup(sessions)
    upstream.setLastFocused(lastFocused)
    expect(await service.resolveTarget(WT, preferred)).toMatchObject(want)
  })
})

describe('send', () => {
  test('one running session delivers the formatted text and deletes the delivered comments', async () => {
    const { service, drafts, ids, delivered, emitted } = setup()
    const cs = await drafts(2)
    const r = await service.send(ids(cs).reverse())
    expect(r).toMatchObject({ status: 'sent', sessionId: 's1' })
    expect(delivered).toHaveLength(1)
    expect(delivered[0]?.text).toBe(service.format(cs))
    expect(delivered[0]).toMatchObject({ sessionId: 's1', worktreeId: WT, mode: 'terminal', ptyId: 'pty-s1' })
    expect(await service.listDrafts(WT)).toEqual([])
    const sentAt = r.status === 'sent' ? r.sentAt : -1
    expect(emitted.at(-1)).toEqual([
      COMMENTS_EVENTS.sent,
      { commentIds: ids(cs).reverse(), sessionId: 's1', worktreeId: WT, sentAt },
    ])
  })

  it.each([false, true])('submit follows the setting (%s)', async (submitAfterPaste) => {
    const { service, drafts, ids, delivered, settings } = setup()
    settings.submitAfterPaste = submitAfterPaste
    await service.send(ids(await drafts(1)))
    expect(delivered[0]?.submit).toBe(submitAfterPaste)
  })

  test('two sessions, no target → needsTarget + comments.sendRequested; promptUser:false publishes nothing', async () => {
    const { service, drafts, ids, upstream, delivered } = setup([makeSession({ id: 'a' }), makeSession({ id: 'b' })])
    const commentIds = ids(await drafts(1))
    const r = await service.send(commentIds)
    expect(r).toMatchObject({ status: 'needsTarget', defaultSessionId: 'a' })
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.sendRequested)).toEqual([{ worktreeId: WT, commentIds, result: r }])
    await service.send(commentIds, undefined, { promptUser: false })
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.sendRequested)).toHaveLength(1)
    expect(delivered).toEqual([])
    expect(ids(await service.listDrafts(WT))).toEqual(commentIds)
  })

  test('only the delivered comments are deleted; the rest stay drafts', async () => {
    const { service, drafts, upstream } = setup()
    const [a, b] = await drafts(2)
    const before = upstream.publishedOn(COMMENTS_IPC_EVENTS.changed).length
    await service.send([a?.id as string])
    expect(await service.listDrafts(WT)).toEqual([b])
    expect(upstream.publishedOn(COMMENTS_IPC_EVENTS.changed)).toHaveLength(before + 1)
  })

  test('no session → noSession, drafts kept', async () => {
    const { service, drafts, ids } = setup([])
    const cs = await drafts(1)
    expect(await service.send(ids(cs))).toEqual({ status: 'noSession' })
    expect(await service.listDrafts(WT)).toEqual(cs)
  })

  test('target exited → sessionNotRunning, drafts unchanged', async () => {
    const { service, drafts, ids, upstream, delivered } = setup([makeSession({ id: 'a' }), makeSession({ id: 'b' })])
    const cs = await drafts(2)
    const target = upstream.sessions.find((x) => x.id === 'a') as SessionRef
    target.status = 'exited'
    expect(await service.send(ids(cs), 'a')).toMatchObject({ status: 'failed', errorKey: 'sessionNotRunning' })
    expect(delivered).toEqual([])
    expect(await service.listDrafts(WT)).toEqual(cs)
  })

  it.each([
    ['empty', async () => [] as string[], undefined, 'empty'],
    ['unknown id', async () => ['nope'], undefined, 'notFound'],
    ['wrong worktree', async (x: Ctx) => x.ids(await x.drafts(1)), 'other', 'wrongWorktree'],
    [
      'mixed worktrees',
      async (x: Ctx) => [...x.ids(await x.drafts(1)), ...x.ids(await x.drafts(1, { worktreeId: OTHER_WT }))],
      undefined,
      'mixedWorktrees',
    ],
    [
      'already sent (deleted) id',
      async (x: Ctx) => {
        const cs = x.ids(await x.drafts(1))
        await x.service.send(cs)
        x.delivered.length = 0
        return cs
      },
      undefined,
      'notFound',
    ],
  ])('validation failure (%s) delivers nothing', async (_n, makeIds, target, errorKey) => {
    const x = setup([makeSession({ id: 's1' }), makeSession({ id: 'other', worktreeId: OTHER_WT })])
    const r = await x.service.send(await makeIds(x), target)
    expect(r).toMatchObject({ status: 'failed', errorKey })
    expect(x.delivered).toHaveLength(0)
  })

  test('concurrent overlapping send delivers once; second returns alreadySending', async () => {
    const { service, drafts, ids, delivered, setDeliver } = setup()
    const cs = ids(await drafts(2))
    let release = (): void => undefined
    const gate = new Promise<void>((r) => {
      release = r
    })
    setDeliver(() => gate)
    const first = service.send(cs)
    const second = await service.send([cs[1] as string])
    expect(second).toMatchObject({ status: 'failed', errorKey: 'alreadySending' })
    release()
    expect(await first).toMatchObject({ status: 'sent' })
    expect(delivered).toHaveLength(1)
  })

  test('deliver throwing → deliveryFailed with message, drafts kept', async () => {
    const { service, drafts, ids, setDeliver } = setup()
    const cs = await drafts(1)
    setDeliver(async () => {
      throw new Error('pty gone')
    })
    expect(await service.send(ids(cs))).toMatchObject({
      status: 'failed',
      errorKey: 'deliveryFailed',
      message: expect.stringContaining('pty gone'),
    })
    expect(await service.listDrafts(WT)).toEqual(cs)
  })

  test('chat-mode session without a chat target → noDeliveryTarget', async () => {
    const { service, drafts, ids } = setup([makeSession({ id: 'c', mode: 'chat' })])
    expect(await service.send(ids(await drafts(1)))).toMatchObject({ errorKey: 'noDeliveryTarget' })
  })
})

type Ctx = ReturnType<typeof setup>
