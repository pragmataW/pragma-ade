import { describe, expect, it } from 'vitest'
import { type ChatEvent, withCurrent } from '../../src/contract'
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
