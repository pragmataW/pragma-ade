import { describe, expect, it } from 'vitest'
import { createClaudeChatCapability } from '../../src/main/chat/capability'
import { FAKE_TEXT } from '../../testing/fake-claude-stream/scenario'
import { isKind, ofKind, startSession } from './support'

describe('ClaudeChatSession mid-turn input', () => {
  it('the capability declares midTurnInput', () => {
    const cap = createClaudeChatCapability({ log: { info() {}, warn() {} } as never, resolveCommand: async () => null })
    expect(cap.midTurnInput).toBe(true)
  })

  it('a send during a turn reaches the CLI before the turn ends; acks and the queued turn follow', async () => {
    const s = await startSession('long-turn')
    await s.session.send({ text: 'first', images: [], messageId: 'm-1' })
    await s.waitForEvent(isKind('text-delta'))
    await s.session.send({ text: 'second', images: [], messageId: 'm-2' })
    await expect.poll(() => s.report()?.userMessages.length).toBe(2)
    expect(s.report()?.results).toEqual([])
    expect(s.report()?.argv).toContain('--replay-user-messages')
    expect(s.report()?.userMessages.map((m) => m.frame.uuid)).toEqual(['m-1', 'm-2'])
    await s.waitForEvent(isKind('message-ack', (e) => e.messageId === 'm-2'))
    await s.waitForEvent(isKind('text-delta', (e) => e.text === FAKE_TEXT.second))
    await expect.poll(() => ofKind(s.events, 'turn-end').length, { timeout: 8000 }).toBe(2)
    const kinds = s.events.map((e) => e.kind)
    const firstEnd = kinds.indexOf('turn-end')
    expect(kinds[firstEnd + 1]).toBe('turn-start')
  })
})
