import { describe, expect, it } from 'vitest'
import type { ChatEvent, ChatSessionContext } from '../../src/contract'
import { createFakeChatCapability, FAKE_OPTIONS, makeProfile } from '../../testing'

const context = (events: ChatEvent[]): ChatSessionContext => ({
  sessionId: 's1',
  profile: makeProfile(),
  worktreePath: '/w',
  env: {},
  startupTimeoutMs: 1000,
  emit: (e) => void events.push(e),
})

describe('createFakeChatCapability', () => {
  it('records sends and option sets; emit reaches ctx.emit', async () => {
    const fake = createFakeChatCapability({ options: FAKE_OPTIONS })
    const events: ChatEvent[] = []
    const handle = await fake.capability.createSession(context(events))
    await handle.send({ text: 'hi', images: [] })
    await handle.setOption('fakeMode', 'b')
    await expect(handle.setOption('fakeMode', 'c')).rejects.toThrow()
    fake.lastSession().emit({ kind: 'turn-start', turnId: 't' })
    fake.lastSession().finishTurn()
    expect(fake.lastSession().sent).toEqual([{ text: 'hi', images: [] }])
    expect(fake.lastSession().optionSets).toEqual([{ key: 'fakeMode', value: 'b' }])
    expect(events.map((e) => e.kind)).toEqual(['session-info', 'options', 'options', 'turn-start', 'turn-end'])
    expect(handle.respond).toBeUndefined()
  })

  it('interactive sessions define respond; close emits session-exit once', async () => {
    const fake = createFakeChatCapability({ interactive: true })
    const events: ChatEvent[] = []
    const handle = await fake.capability.createSession(context(events))
    await handle.respond?.('e1', { ok: true })
    await handle.close()
    await handle.close()
    expect(fake.lastSession().responses).toEqual([{ eventId: 'e1', payload: { ok: true } }])
    expect(events.filter((e) => e.kind === 'session-exit')).toHaveLength(1)
  })
})
