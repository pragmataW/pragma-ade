import { describe, expect, it } from 'vitest'
import { type ChatEvent, type ChatOptionDescriptor, withCurrent } from '../../src/contract'
import { FAKE_OPTIONS } from '../../testing'
import { harness } from './harness'

const history: ChatEvent[] = [
  { kind: 'message', messageId: 'u1', role: 'user', text: 'old', attachments: [], origin: 'history' },
  { kind: 'text-delta', messageId: 'a1', partId: 'a1:0', text: 'answer', mode: 'snapshot' },
]

describe('ChatSessionRegistry', () => {
  it('dormant open loads history with status exited', async () => {
    const h = harness({ history })
    h.agents.sessions.set('s1', { ...h.session, status: 'idle', externalSessionId: 'ext-1' })
    const c = await h.registry().open('s1')
    expect(h.fake.historyRequests).toEqual(['ext-1'])
    expect(c.snapshot()).toMatchObject({ providerId: 'prov', status: 'exited' })
    expect(c.snapshot().transcript.items.map((i) => i.kind)).toEqual(['message', 'text-delta'])
  })

  it('open without an external session id is empty; unknown ids reject', async () => {
    const h = harness({ history })
    const r = h.registry()
    expect((await r.open('s1')).snapshot().transcript.items).toEqual([])
    await expect(r.open('nope')).rejects.toThrow()
  })

  it('after an app restart a dormant session shows its last options and resumes with the chosen value', async () => {
    const h = harness({ history, options: FAKE_OPTIONS })
    const live = h.registry().attach(h.request())
    await live.whenAttached()
    await live.setOption('fakeMode', 'b')
    h.fake.lastSession().emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
    h.agents.sessions.set('s1', { ...h.session, status: 'exited', externalSessionId: 'fake-ext-1' })
    const dormant = await h.registry().open('s1')
    expect(dormant.snapshot().transcript.info.options).toEqual(withCurrent(FAKE_OPTIONS, 'fakeMode', 'b'))
    await dormant.setOption('fakeMode', 'a')
    await dormant.attach(h.request({ resume: { externalSessionId: 'fake-ext-1' } }))
    expect(h.fake.lastSession().createdWith.initialOptions).toEqual({ fakeMode: 'a' })
  })

  describe('a dormant session without saved options (created before the options store)', () => {
    const permission: ChatOptionDescriptor = {
      key: 'permissionMode',
      type: 'enum',
      labelKey: 'chat:option.permissionMode',
      values: [
        { value: 'default', label: 'Ask' },
        { value: 'plan', label: 'Plan' },
      ],
      default: 'default',
      current: 'plan',
    }

    it("shows the provider's static default options, and a choice made before the start is applied", async () => {
      const h = harness({ history, defaultOptions: [permission] })
      h.agents.sessions.set('s1', { ...h.session, status: 'exited', externalSessionId: 'ext-1' })
      const dormant = await h.registry().open('s1')
      expect(dormant.snapshot().transcript.info.options).toEqual([permission])
      await dormant.setOption('permissionMode', 'default')
      await dormant.attach(h.request({ resume: { externalSessionId: 'ext-1' } }))
      expect(h.fake.lastSession().createdWith.initialOptions).toEqual({ permissionMode: 'default' })
    })

    it("shows the profile's last-known options, with the values a fresh start would use", async () => {
      const h = harness({ history, options: [...FAKE_OPTIONS, permission], defaultOptions: [permission] })
      const live = h.registry().attach(h.request())
      await live.whenAttached()
      await live.setOption('fakeMode', 'b')
      await live.setOption('permissionMode', 'default')
      h.agents.sessions.set('s2', { ...h.session, id: 's2', status: 'exited', externalSessionId: 'ext-2' })
      const { transcript } = (await h.registry().open('s2')).snapshot()
      expect(transcript.info.options).toEqual([...FAKE_OPTIONS, permission])
    })

    it('without static defaults or last-known options the toolbar stays empty', async () => {
      const h = harness({ history })
      h.agents.sessions.set('s1', { ...h.session, status: 'exited', externalSessionId: 'ext-1' })
      expect((await h.registry().open('s1')).snapshot().transcript.info.options).toEqual([])
    })
  })

  it('a failed history load still opens the session, with its options and a non-fatal notice', async () => {
    const h = harness({ historyError: new Error('Cursor cannot be combined with order'), options: FAKE_OPTIONS })
    h.optionsStore.set('s1', { options: FAKE_OPTIONS, chosen: {} })
    h.agents.sessions.set('s1', { ...h.session, status: 'idle', externalSessionId: 'ext-1' })
    const { transcript } = (await h.registry().open('s1')).snapshot()
    expect(transcript.info.options).toEqual(FAKE_OPTIONS)
    expect(transcript.items).toEqual([
      expect.objectContaining({
        kind: 'error',
        message: 'chat:errors.historyLoadFailed',
        detail: expect.stringContaining('Cursor cannot be combined with order'),
      }),
    ])
  })

  describe('a resumed start of a session not opened yet (e.g. a terminal session continued in chat)', () => {
    const resume = { externalSessionId: 'ext-1' }

    it('shows the conversation so far before the live events, and publishes it to an open view', async () => {
      const h = harness({ history })
      const c = h.registry().attach(h.request({ resume }))
      await c.whenAttached()
      expect(h.fake.historyRequests).toEqual(['ext-1'])
      const kinds = c.snapshot().transcript.items.map((i) => i.kind)
      expect(kinds.slice(0, 2)).toEqual(['message', 'text-delta'])
      expect(h.kinds().slice(0, 2)).toEqual(['message', 'text-delta'])
      expect(h.fake.lastSession().createdWith.resumeExternalSessionId).toBe('ext-1')
    })

    it('keeps the history after the resumed process ends (not only "Session ended")', async () => {
      const h = harness({ history })
      const c = h.registry().attach(h.request({ resume }))
      await c.whenAttached()
      await h.fake.lastSession().close()
      const kinds = c.snapshot().transcript.items.map((i) => i.kind)
      expect(kinds).toEqual(expect.arrayContaining(['message', 'text-delta', 'session-exit']))
    })

    it('an open racing the start returns the controller with the history', async () => {
      const h = harness({ history })
      h.agents.sessions.set('s1', { ...h.session, status: 'exited', externalSessionId: 'ext-1' })
      const r = h.registry()
      const opening = r.open('s1')
      const c = r.attach(h.request({ resume }))
      expect(await opening).toBe(c)
      await c.whenAttached()
      expect(c.snapshot().transcript.items.filter((i) => i.kind === 'message')).toHaveLength(1)
    })

    it('a fresh start (no resume) loads no history', async () => {
      const h = harness({ history })
      const c = h.registry().attach(h.request())
      await c.whenAttached()
      expect(h.fake.historyRequests).toEqual([])
    })

    it('a failed history load still starts the session, with a non-fatal notice', async () => {
      const h = harness({ historyError: new Error('boom') })
      const c = h.registry().attach(h.request({ resume }))
      await c.whenAttached()
      expect(c.snapshot().status).not.toBe('exited')
      expect(c.snapshot().transcript.items[0]).toMatchObject({
        kind: 'error',
        message: 'chat:errors.historyLoadFailed',
      })
    })
  })

  it('attach creates a live controller; stop closes it; closeAll closes every controller', async () => {
    const h = harness()
    const r = h.registry()
    const c = r.attach(h.request())
    await c.whenAttached()
    expect(r.get('s1')).toBe(c)
    await r.stop(h.session, 'kill')
    expect(h.fake.lastSession().killed).toBe(true)
    await r.closeAll()
  })
})
