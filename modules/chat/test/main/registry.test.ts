import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../../src/contract'
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
