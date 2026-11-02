import { AgentsError } from '@pragma/module-agents/contract'
import { describe, expect, it, vi } from 'vitest'
import type { ChangedEvent } from '../src/contract'
import { createExternalSessionGuard } from '../src/main/external-session-guard'
import { createChatSwitchService } from '../src/main/switch-service'
import {
  CLAUDE,
  chatOk,
  claudeResume,
  EXTERNAL_ID,
  type FakeCaps,
  fakeAgents,
  fakeProviders,
  makeSession,
  OTHER_SESSION_ID,
  SERVE_URL,
  SESSION_ID,
  silentLog,
} from './support'

const OPENCODE_ID = 'ses_1'

/** A service over fakes; `caps` defaults to Claude with resume + chat. */
function setup(o: { session?: Parameters<typeof makeSession>[0]; caps?: FakeCaps } = {}) {
  const agents = fakeAgents([makeSession(o.session)])
  const guard = createExternalSessionGuard()
  const events: ChangedEvent[] = []
  const caps = o.caps ?? { resume: { [CLAUDE]: claudeResume() }, chat: { [CLAUDE]: chatOk() } }
  const service = createChatSwitchService({
    agents,
    providers: fakeProviders(caps),
    guard,
    worktreePath: async () => '/w',
    publish: (e) => void events.push(e),
    log: silentLog(),
  })
  return { agents, guard, events, service, phases: () => events.map((e) => e.phase) }
}

/** OpenCode with a chat capability whose `retainServer` returns a lease on `SERVE_URL`. */
function withRetain() {
  const release = vi.fn(async () => undefined)
  const retainServer = vi.fn(async () => ({ url: SERVE_URL, release }))
  const caps: FakeCaps = {
    resume: { opencode: claudeResume() },
    chat: { opencode: { ...chatOk(), retainServer } },
  }
  const s = setup({
    session: { providerId: 'opencode', profileId: 'builtin:opencode', externalSessionId: OPENCODE_ID },
    caps,
  })
  return { ...s, release, retainServer }
}

describe('ChatSwitchService', () => {
  it('chat→terminal calls relaunchSession with mode terminal and resume X; switching → done', async () => {
    const s = setup()
    expect(await s.service.switchTo(SESSION_ID, 'terminal')).toEqual({ ok: true, sessionId: SESSION_ID })
    expect(s.agents.relaunches).toEqual([
      { id: SESSION_ID, opts: { mode: 'terminal', resume: { externalSessionId: EXTERNAL_ID } } },
    ])
    expect(s.phases()).toEqual(['switching', 'done'])
    expect(s.guard.ownerOf({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID })).toBe(SESSION_ID)
  })

  it('retained serve url is passed as resume.serverUrl (retain before relaunch)', async () => {
    const s = withRetain()
    await s.service.switchTo(SESSION_ID, 'terminal')
    expect(s.agents.relaunches[0]?.opts.resume).toEqual({ externalSessionId: OPENCODE_ID, serverUrl: SERVE_URL })
    const retainOrder = s.retainServer.mock.invocationCallOrder[0] ?? 0
    expect(retainOrder).toBeLessThan(s.agents.relaunchSession.mock.invocationCallOrder[0] ?? 0)
    expect(s.retainServer).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: '/w', externalSessionId: OPENCODE_ID }),
    )
  })

  it('no retainServer → no serverUrl', async () => {
    const s = setup()
    await s.service.switchTo(SESSION_ID, 'terminal')
    expect(s.agents.relaunches[0]?.opts.resume).not.toHaveProperty('serverUrl')
  })

  it('terminal → chat never retains', async () => {
    const s = withRetain()
    s.agents.rows.set(SESSION_ID, { ...(s.agents.rows.get(SESSION_ID) ?? makeSession()), mode: 'terminal' })
    await s.service.switchTo(SESSION_ID, 'chat')
    expect(s.retainServer).not.toHaveBeenCalled()
    expect(s.agents.relaunches[0]?.opts).toEqual({ mode: 'chat', resume: { externalSessionId: OPENCODE_ID } })
  })

  it.each([
    [
      'releaseServe (terminal exit / switched back to chat)',
      async (s: ReturnType<typeof withRetain>) => {
        await s.service.switchTo(SESSION_ID, 'terminal')
        await s.service.releaseServe(SESSION_ID)
      },
    ],
    [
      'relaunch failure',
      async (s: ReturnType<typeof withRetain>) => {
        s.agents.relaunchSession.mockRejectedValueOnce(new AgentsError('spawnFailed'))
        await s.service.switchTo(SESSION_ID, 'terminal')
      },
    ],
    [
      'releaseAllServes (deactivate)',
      async (s: ReturnType<typeof withRetain>) => {
        await s.service.switchTo(SESSION_ID, 'terminal')
        await s.service.releaseAllServes()
      },
    ],
  ])('lease released on %s', async (_n, act) => {
    const s = withRetain()
    await act(s)
    expect(s.release).toHaveBeenCalledTimes(1)
    await s.service.releaseServe(SESSION_ID)
    expect(s.release).toHaveBeenCalledTimes(1)
  })

  it('rejects a concurrent switch for the same session', async () => {
    const s = setup()
    const [a, b] = await Promise.all([
      s.service.switchTo(SESSION_ID, 'terminal'),
      s.service.switchTo(SESSION_ID, 'terminal'),
    ])
    expect(a).toEqual({ ok: true, sessionId: SESSION_ID })
    expect(b).toEqual({ ok: false, errorKey: 'chat-switch:error.inProgress' })
    expect(s.agents.relaunchSession).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['idUnknown', { session: { externalSessionId: null } }, undefined],
    ['noResume', { caps: { chat: { [CLAUDE]: chatOk() } } }, undefined],
    ['busy', {}, OTHER_SESSION_ID],
  ] as const)('ineligible (%s) returns the reason without relaunch', async (reason, o, owner) => {
    const s = setup(o)
    if (owner) s.guard.claim({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID }, owner)
    expect(await s.service.switchTo(SESSION_ID, 'terminal')).toEqual({
      ok: false,
      errorKey: `chat-switch:reason.${reason}`,
    })
    expect(s.agents.relaunchSession).not.toHaveBeenCalled()
    expect(s.events).toEqual([])
  })

  it('relaunch failure releases the guard and publishes failed; a later switch is allowed', async () => {
    const s = setup()
    s.agents.relaunchSession.mockRejectedValueOnce(new AgentsError('spawnFailed'))
    expect(await s.service.switchTo(SESSION_ID, 'terminal')).toEqual({
      ok: false,
      errorKey: 'agents:errors.spawnFailed',
    })
    expect(s.events.at(-1)).toEqual({ sessionId: SESSION_ID, phase: 'failed', errorKey: 'agents:errors.spawnFailed' })
    expect(s.guard.ownerOf({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID })).toBeUndefined()
    expect((await s.service.switchTo(SESSION_ID, 'terminal')).ok).toBe(true)
  })

  it('an unknown failure maps to startFailed', async () => {
    const s = setup()
    s.agents.relaunchSession.mockRejectedValueOnce(new Error('boom'))
    expect(await s.service.switchTo(SESSION_ID, 'terminal')).toEqual({
      ok: false,
      errorKey: 'chat-switch:error.startFailed',
    })
  })

  it('eligibility: chat target reports the chat capability support', async () => {
    const s = setup({ session: { mode: 'terminal' }, caps: { resume: { [CLAUDE]: claudeResume() } } })
    expect(await s.service.eligibility(SESSION_ID)).toEqual({
      terminal: { ok: false, reasonKey: 'chat-switch:reason.currentMode' },
      chat: { ok: false, reasonKey: 'chat-switch:reason.noChat' },
    })
  })
})
