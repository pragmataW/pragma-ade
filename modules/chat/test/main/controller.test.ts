import { describe, expect, it, vi } from 'vitest'
import { type ChatEvent, ChatStartupError, emptyTranscript, reduceTranscript, withCurrent } from '../../src/contract'
import { ChatSessionController } from '../../src/main/controller'
import { FAKE_OPTIONS, makeTranscript } from '../../testing'
import { flush, harness } from './harness'

const input = (text: string) => ({ text, images: [] })
const permission: ChatEvent = {
  kind: 'permission-request',
  requestId: 'r1',
  toolName: 'Run',
  toolKind: 'shell',
  title: 'ls',
  input: {},
  options: ['allow_once', 'deny'],
}

describe('ChatSessionController', () => {
  it('send dispatches message, turn-start, handle.send; working then idle', async () => {
    const h = harness()
    const c = await h.attached()
    expect(await c.send(input('hi'))).toEqual({ queued: false })
    expect(h.kinds().slice(-2)).toEqual(['message', 'turn-start'])
    expect(h.fake.lastSession().sent).toMatchObject([input('hi')])
    h.fake.lastSession().finishTurn()
    expect(h.statuses()).toEqual(['idle', 'working', 'idle'])
  })

  it('midTurnInput: a send during a turn goes straight to the provider, marked midTurn, without a new turn', async () => {
    const h = harness({ midTurnInput: true })
    const c = await h.attached()
    await c.send(input('one'))
    expect(await c.send(input('two'))).toEqual({ queued: false })
    expect(h.fake.lastSession().sent.map((s) => s.text)).toEqual(['one', 'two'])
    expect(h.kinds().filter((k) => k === 'turn-start')).toHaveLength(1)
    const [first, second] = c.snapshot().transcript.items.filter((i) => i.kind === 'message')
    expect(first).not.toHaveProperty('midTurn')
    expect(second).toMatchObject({ text: 'two', midTurn: true })
    expect(h.fake.lastSession().sent[1]?.messageId).toBe(second?.id)
    expect(c.snapshot().transcript.queue).toEqual([])
  })

  it('midTurnInput: one shared turn-end ends the turn (idle, nothing queued); the next send starts a new turn', async () => {
    const h = harness({ midTurnInput: true })
    const c = await h.attached()
    await c.send(input('one'))
    await c.send(input('two'))
    h.fake.lastSession().finishTurn()
    expect(h.statuses().at(-1)).toBe('idle')
    expect(c.snapshot().transcript.turnActive).toBe(false)
    expect(c.snapshot().transcript.queue).toEqual([])
    await c.send(input('three'))
    expect(h.kinds().filter((k) => k === 'turn-start')).toHaveLength(2)
    const third = c
      .snapshot()
      .transcript.items.filter((i) => i.kind === 'message')
      .at(-1)
    expect(third).toMatchObject({ text: 'three' })
    expect(third).not.toHaveProperty('midTurn')
  })

  it('message-ack clears the mid-turn marker', () => {
    const t = makeTranscript([
      { kind: 'message', messageId: 'm', role: 'user', text: 'x', attachments: [], origin: 'live', midTurn: true },
      { kind: 'message-ack', messageId: 'm' },
    ])
    expect(t.items[0]).not.toHaveProperty('midTurn')
  })

  it('handle.send gets the id of the message item it starts (rewind targets)', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('hi'))
    const message = h.published.map((p) => p.event).find((e) => e.kind === 'message')
    const messageId = message?.kind === 'message' ? message.messageId : 'none'
    expect(h.fake.lastSession().sentMeta).toEqual([{ messageId }])
  })

  it('sends during a turn queue FIFO and dispatch after each turn-end', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('one'))
    expect(await c.send(input('two'))).toEqual({ queued: true })
    await c.send(input('three'))
    expect(c.snapshot().transcript.queue.map((q) => q.text)).toEqual(['two', 'three'])
    h.fake.lastSession().finishTurn()
    await flush()
    expect(h.fake.lastSession().sent.map((s) => s.text)).toEqual(['one', 'two'])
    h.fake.lastSession().finishTurn()
    await flush()
    expect(h.fake.lastSession().sent.map((s) => s.text)).toEqual(['one', 'two', 'three'])
    expect(c.snapshot().transcript.queue).toEqual([])
  })

  it('cancelQueued removes the item and it is never sent', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('one'))
    await c.send(input('two'))
    const [queued] = c.snapshot().transcript.queue
    c.cancelQueued(queued?.id ?? '')
    h.fake.lastSession().finishTurn()
    await flush()
    expect(h.fake.lastSession().sent.map((s) => s.text)).toEqual(['one'])
  })

  it('queued message dispatches after an interrupted turn', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('one'))
    await c.send(input('two'))
    await c.interrupt()
    h.fake.lastSession().finishTurn('interrupted')
    await flush()
    expect(h.fake.lastSession().interrupts).toBe(1)
    expect(h.fake.lastSession().sent.map((s) => s.text)).toEqual(['one', 'two'])
  })

  it('permission-request → status waiting persisted via updateSession and reported waitingForUser', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('go'))
    h.fake.lastSession().emit(permission)
    expect(c.snapshot().status).toBe('waiting')
    expect(h.statuses().at(-1)).toBe('waiting')
    expect(h.agents.reports.at(-1)?.event).toMatchObject({ kind: 'waitingForUser', reason: 'permission' })
    await c.respondPermission('r1', 'allow_once')
    expect(h.fake.lastSession().permissionResponses).toEqual([{ requestId: 'r1', decision: 'allow_once' }])
  })

  it('an event the contract rejects is logged and dropped: never published, never in the transcript, session lives', async () => {
    const h = harness()
    const c = await h.attached()
    const before = h.published.length
    const bad = { kind: 'task', taskId: 't1', taskKind: 'background', name: 'Bash' } as unknown as ChatEvent
    expect(() => h.fake.lastSession().emit(bad)).not.toThrow()
    expect(h.published).toHaveLength(before)
    expect(c.snapshot().transcript.items.filter((i) => i.kind === 'task')).toEqual([])
    expect(h.deps.log.warn).toHaveBeenCalledWith(expect.stringContaining('invalid task event'), expect.anything())
    h.fake.lastSession().emit(permission)
    expect(h.kinds().at(-1)).toBe('permission-request')
    expect(h.exits).toEqual([])
  })

  it('externalSessionId persisted after createSession', async () => {
    const h = harness()
    await h.attached()
    expect(h.agents.updates).toContainEqual({ id: 's1', patch: { externalSessionId: 'fake-ext-1' } })
  })

  it('a session-info with a new externalSessionId (fork) is persisted; the same id is not written again', async () => {
    const h = harness()
    await h.attached()
    const writes = () => h.agents.updates.filter((u) => 'externalSessionId' in u.patch)
    const before = writes().length
    h.fake.lastSession().emit({ kind: 'session-info', externalSessionId: 'fake-ext-1' })
    await flush()
    expect(writes()).toHaveLength(before)
    h.fake.lastSession().emit({ kind: 'session-info', externalSessionId: 'forked-2' })
    await flush()
    expect(writes().at(-1)).toEqual({ id: 's1', patch: { externalSessionId: 'forked-2' } })
  })

  it('child env is exactly buildLaunchEnv({sessionId, resume}) (decorator PATH and PRAGMA_SESSION_ID present)', async () => {
    const h = harness()
    await h.attached({ resume: { externalSessionId: 'ext-9' } })
    expect(h.agents.envRequests).toEqual([{ sessionId: 's1', resume: { externalSessionId: 'ext-9' } }])
    expect(h.fake.lastSession().createdWith.env).toEqual(h.agents.env)
    expect(h.fake.lastSession().createdWith).toMatchObject({ resumeExternalSessionId: 'ext-9', worktreePath: '/w' })
  })

  it('session-exit calls reportExit exactly once per attach', async () => {
    const h = harness()
    const c = await h.attached()
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 3, reason: 'crashed' })
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 4, reason: 'crashed' })
    expect(h.exits).toEqual([3])
    await c.attach(h.request())
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
    expect(h.exits).toEqual([3, 0])
  })

  it.each([true, false])(
    'respond forwards when handle.respond exists (interactive=%s), rejects otherwise',
    async (interactive) => {
      const h = harness({ interactive })
      const c = await h.attached()
      const reply = c.respond('e1', { a: 1 })
      if (interactive) {
        await reply
        expect(h.fake.lastSession().responses).toEqual([{ eventId: 'e1', payload: { a: 1 } }])
      } else await expect(reply).rejects.toThrow('chat:errors.respondUnsupported')
    },
  )

  it('setOption forwards to handle; invalid value rejects; dormant setOption becomes initialOptions on resume', async () => {
    const h = harness({ options: FAKE_OPTIONS })
    const c = await h.attached()
    await c.setOption('fakeMode', 'b')
    expect(h.fake.lastSession().optionSets).toEqual([{ key: 'fakeMode', value: 'b' }])
    await expect(c.setOption('fakeMode', 'zzz')).rejects.toThrow()
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
    await c.setOption('fakeMode', 'a')
    await expect(c.setOption('fakeMode', 'zzz')).rejects.toThrow()
    expect(c.snapshot().transcript.info.options[0]?.current).toBe('a')
    await c.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.initialOptions).toEqual({ fakeMode: 'a' })
  })

  it('a live option choice is reapplied when the chat process restarts (resume)', async () => {
    const h = harness({ options: FAKE_OPTIONS })
    const c = await h.attached()
    await c.setOption('fakeMode', 'b')
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 1, reason: 'crashed' })
    await c.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.initialOptions).toEqual({ fakeMode: 'b' })
  })

  it('a chosen option the agent changed later (plan approved) resumes with the newer value', async () => {
    const h = harness({ options: FAKE_OPTIONS })
    const c = await h.attached()
    await c.setOption('fakeMode', 'b')
    h.fake.lastSession().emit({ kind: 'options', options: withCurrent(FAKE_OPTIONS, 'fakeMode', 'a') })
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
    await c.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.initialOptions).toEqual({ fakeMode: 'a' })
  })

  it('options the user never chose are not forced on a resume', async () => {
    const h = harness({ options: FAKE_OPTIONS })
    const c = await h.attached()
    h.fake.lastSession().emit({ kind: 'options', options: withCurrent(FAKE_OPTIONS, 'fakeMode', 'b') })
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
    await c.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.initialOptions).toEqual({})
  })

  it('startup failure → error + session-exit startup_failed, status error, support cache records reason', async () => {
    const h = harness({ startupError: new ChatStartupError('chat:unsupported.noProtocol', 'no json') })
    const c = await h.attached()
    expect(h.kinds().slice(-2)).toEqual(['error', 'session-exit'])
    expect(h.published.at(-2)?.event).toMatchObject({
      code: 'startup_unsupported',
      message: 'chat:unsupported.noProtocol',
      detail: 'no json',
      fatal: true,
    })
    expect(c.snapshot().status).toBe('error')
    expect(h.exits).toEqual([null])
    expect(h.statuses().at(-1)).toBe('error')
    expect(h.supportCache.get(h.profile)).toEqual({ reasonKey: 'chat:unsupported.noProtocol', detail: 'no json' })
  })

  describe('resume failures (11c)', () => {
    const RESUME = { externalSessionId: 'gone-1' }

    it('notFound → a fresh session (no resume), the fallback listener, no error and no support-cache entry', async () => {
      const h = harness()
      const create = vi.spyOn(h.fake.capability, 'createSession')
      create.mockRejectedValueOnce(new ChatStartupError('chat:resume.notFound', 'exit 1: No conversation found'))
      const onResumeFallback = vi.fn()
      const c = new ChatSessionController({
        ...h.deps,
        sessionId: h.session.id,
        onResumeFallback,
      })
      await c.attach(h.request({ resume: RESUME }))
      expect(create).toHaveBeenCalledTimes(2)
      expect(create.mock.calls[0]?.[0].resumeExternalSessionId).toBe('gone-1')
      expect(create.mock.calls[1]?.[0].resumeExternalSessionId).toBeUndefined()
      expect(onResumeFallback).toHaveBeenCalledWith({ sessionId: h.session.id, externalSessionId: 'gone-1' })
      expect(h.kinds()).not.toContain('error')
      expect(c.snapshot().status).not.toBe('error')
      expect(h.supportCache.get(h.profile)).toBeUndefined()
      expect(c.snapshot().transcript.info.externalSessionId).not.toBe('gone-1')
    })

    it('another resume failure is a fatal error with the CLI reason, not "unsupported"', async () => {
      const h = harness({ startupError: new ChatStartupError('chat:resume.failed', 'exit 1: boom') })
      await h.attached({ resume: RESUME })
      expect(h.published.at(-2)?.event).toMatchObject({
        code: 'unknown',
        message: 'chat:resume.failed',
        detail: 'exit 1: boom',
        fatal: true,
      })
      expect(h.supportCache.get(h.profile)).toBeUndefined()
    })

    it('notFound without a resume is not retried', async () => {
      const h = harness({ startupError: new ChatStartupError('chat:resume.notFound', 'x') })
      await h.attached()
      expect(h.published.at(-2)?.event).toMatchObject({ message: 'chat:resume.notFound', fatal: true })
    })
  })

  it('no chat capability → chat:unsupported.noCapability', async () => {
    const h = harness({ noCapability: true })
    await h.attached()
    expect(h.published.at(-2)?.event).toMatchObject({ message: 'chat:unsupported.noCapability' })
    expect(h.exits).toEqual([null])
  })

  it('snapshot mid-stream + published tail rebuilds identical transcript', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('hi'))
    const delta = (text: string): ChatEvent => ({
      kind: 'text-delta',
      messageId: 'a',
      partId: 'a:0',
      text,
      mode: 'delta',
    })
    h.fake.lastSession().emit(delta('Hel'))
    const mid = c.snapshot().transcript
    h.fake.lastSession().emit(delta('lo'))
    h.fake.lastSession().emit(permission)
    h.fake.lastSession().finishTurn()
    const rebuilt = h.published.reduce(reduceTranscript, mid)
    expect(rebuilt).toEqual(c.snapshot().transcript)
    expect(h.published.reduce(reduceTranscript, emptyTranscript())).toEqual(c.snapshot().transcript)
  })

  it('send after crash calls relaunchSession(mode chat); the next attach resumes with resumeExternalSessionId and dispatches the pending input', async () => {
    const h = harness()
    const c = await h.attached()
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 1, reason: 'crashed' })
    expect(c.snapshot().status).toBe('exited')
    expect(await c.send(input('again'))).toEqual({ queued: false })
    expect(h.agents.relaunches).toEqual([
      { id: 's1', opts: { mode: 'chat', resume: { externalSessionId: 'fake-ext-1' } } },
    ])
    await c.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.resumeExternalSessionId).toBe('fake-ext-1')
    expect(h.fake.lastSession().sent).toMatchObject([input('again')])
  })

  it('initial prompt is dispatched after the handshake', async () => {
    const h = harness()
    await h.attached({ initialPrompt: 'start here' })
    expect(h.fake.lastSession().sent).toMatchObject([input('start here')])
  })

  it('close: handle closed, queue cleared, status exited', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send(input('one'))
    await c.send(input('two'))
    await c.close()
    expect(h.fake.lastSession().closed).toBe(true)
    expect(c.snapshot().transcript.queue).toEqual([])
    expect(c.snapshot().status).toBe('exited')
    expect(h.exits).toEqual([0])
  })

  it('close during startup closes the handle as soon as it exists', async () => {
    const h = harness()
    const c = h.controller()
    const attaching = c.attach(h.request())
    await c.close()
    await attaching
    expect(h.fake.lastSession().closed).toBe(true)
    expect(h.exits).toEqual([0])
  })
})
