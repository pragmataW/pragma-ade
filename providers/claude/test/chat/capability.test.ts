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

  it.each([
    [[], 'default'],
    [['--dangerously-skip-permissions'], 'bypassPermissions'],
    [['--permission-mode', 'plan', '--verbose'], 'plan'],
  ])('defaultOptions (no process): the permission picker in the mode the args %j start in', (args, mode) => {
    const [permission, ...rest] = createClaudeChatCapability(fakeCapabilityContext()).defaultOptions?.(
      profileFor('claude', args),
    ) ?? [undefined]
    expect(rest).toEqual([])
    expect(permission).toMatchObject({ key: 'permissionMode', type: 'enum', current: mode, default: 'default' })
    expect(permission?.values?.map((v) => v.value)).toEqual(
      expect.arrayContaining(['default', 'acceptEdits', 'plan', 'bypassPermissions']),
    )
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
