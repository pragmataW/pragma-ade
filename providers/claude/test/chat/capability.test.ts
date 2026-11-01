import { fakeCapabilityContext } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createClaudeChatCapability } from '../../src/main/chat/capability'
import { isKind, profileFor, sessionContext } from './support'

describe('createClaudeChatCapability', () => {
  it.each([
    ['/bin/claude', { ok: true }],
    [null, { ok: false, reasonKey: 'chat:unsupported.commandNotFound', detail: 'claude' }],
  ])('checkSupport uses capCtx.resolveCommand (%s)', async (resolved, expected) => {
    const seen: string[] = []
    const cap = createClaudeChatCapability(
      fakeCapabilityContext({
        resolveCommand: async (cmd) => {
          seen.push(cmd)
          return resolved
        },
      }),
    )
    expect(await cap.checkSupport(profileFor('claude'))).toEqual(expected)
    expect(seen).toEqual(['claude'])
  })

  it('dispose closes every live session and each emits session-exit closed', async () => {
    const cap = createClaudeChatCapability(fakeCapabilityContext())
    const a = sessionContext('basic')
    const b = sessionContext('basic')
    await cap.createSession(a.ctx)
    await cap.createSession(b.ctx)
    await cap.dispose?.()
    for (const events of [a.events, b.events])
      expect(events.filter(isKind('session-exit'))).toEqual([expect.objectContaining({ reason: 'closed' })])
  })
})
