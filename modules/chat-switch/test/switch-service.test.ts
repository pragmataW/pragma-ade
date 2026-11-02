import { AgentsError } from '@pragma/module-agents/contract'
import { describe, expect, it, vi } from 'vitest'
import type { ChangedEvent, ResumeCapability } from '../src/contract'
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
  LAUNCH_ENV,
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

/** Claude whose `hasConversation` answers `found` (after recording its call order). */
function withConversation(found: boolean | Error) {
  const hasConversation = vi.fn(async () => {
    if (found instanceof Error) throw found
    return found
  })
  const s = setup({
    caps: { resume: { [CLAUDE]: { ...claudeResume(), hasConversation } }, chat: { [CLAUDE]: chatOk() } },
  })
  return { ...s, hasConversation }
}

/** OpenCode with a chat capability whose `retainServer` returns a lease on `SERVE_URL`. */
function withRetain(hasConversation?: ResumeCapability['hasConversation']) {
  const release = vi.fn(async () => undefined)
  const retainServer = vi.fn(async () => ({ url: SERVE_URL, release }))
  const caps: FakeCaps = {
    resume: { opencode: { ...claudeResume(), ...(hasConversation ? { hasConversation } : {}) } },
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

  it.each(['terminal', 'chat'] as const)(
    'no external id yet → stops and starts a fresh %s session (no lookup, no claim)',
    async (target) => {
      const s = withConversation(true)
      const from = target === 'chat' ? 'terminal' : 'chat'
      s.agents.rows.set(SESSION_ID, makeSession({ mode: from, status: 'starting', externalSessionId: null }))
      const r = await s.service.switchTo(SESSION_ID, target)
      expect(r).toEqual({ ok: true, sessionId: SESSION_ID, noticeKey: `chat-switch:notice.fresh.${target}` })
      expect(s.agents.stops).toEqual([SESSION_ID])
      expect(s.agents.relaunches).toEqual([{ id: SESSION_ID, opts: { mode: target } }])
      expect(s.hasConversation).not.toHaveBeenCalled()
      expect(s.guard.ownerOf({ providerId: CLAUDE, externalSessionId: '' })).toBeUndefined()
    },
  )

  it.each([
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

  describe('nothing to resume (hasConversation)', () => {
    it.each(['terminal', 'chat'] as const)('→ %s: relaunches without resume and returns the notice', async (target) => {
      const s = withConversation(false)
      const from = target === 'chat' ? 'terminal' : 'chat'
      s.agents.rows.set(SESSION_ID, makeSession({ mode: from }))
      const r = await s.service.switchTo(SESSION_ID, target)
      const noticeKey = `chat-switch:notice.fresh.${target}`
      expect(r).toEqual({ ok: true, sessionId: SESSION_ID, noticeKey })
      expect(s.agents.relaunches).toEqual([{ id: SESSION_ID, opts: { mode: target } }])
      expect(s.events.at(-1)).toEqual({ sessionId: SESSION_ID, phase: 'done', noticeKey })
      expect(s.guard.ownerOf({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID })).toBeUndefined()
    })

    it('asks after the old process stopped, in the worktree with the launch env', async () => {
      const s = withConversation(true)
      await s.service.switchTo(SESSION_ID, 'terminal')
      const stopped = s.agents.stopSession.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
      expect(stopped).toBeLessThan(s.hasConversation.mock.invocationCallOrder[0] ?? 0)
      expect(s.agents.stops).toEqual([SESSION_ID])
      expect(s.hasConversation).toHaveBeenCalledWith({
        externalSessionId: EXTERNAL_ID,
        worktreePath: '/w',
        env: LAUNCH_ENV,
      })
      expect(s.agents.relaunches[0]?.opts).toEqual({ mode: 'terminal', resume: { externalSessionId: EXTERNAL_ID } })
    })

    // the env pipeline runs every launch decorator for the row's CURRENT mode: after the stop that would re-track
    // the exited chat as an `external` status source, and the terminal's hook status would never reach the row
    it('builds the lookup env while the old process still runs (never between stop and relaunch)', async () => {
      const s = withConversation(false)
      await s.service.switchTo(SESSION_ID, 'terminal')
      const built = s.agents.buildLaunchEnv.mock.invocationCallOrder
      expect(built).toHaveLength(1)
      expect(built[0] ?? Number.POSITIVE_INFINITY).toBeLessThan(s.agents.stopSession.mock.invocationCallOrder[0] ?? 0)
    })

    it.each([
      ['lookup', () => withConversation(new Error('EACCES'))],
      [
        'launch env',
        () => {
          const s = withConversation(false)
          s.agents.buildLaunchEnv.mockRejectedValueOnce(new Error('no worktree'))
          return s
        },
      ],
    ])('a failing %s resumes anyway', async (_n, make) => {
      const s = make()
      expect(await s.service.switchTo(SESSION_ID, 'terminal')).toEqual({ ok: true, sessionId: SESSION_ID })
      expect(s.agents.relaunches[0]?.opts.resume).toEqual({ externalSessionId: EXTERNAL_ID })
    })

    it('a retained serve lease is released when nothing is resumed', async () => {
      const s = withRetain(vi.fn(async () => false))
      await s.service.switchTo(SESSION_ID, 'terminal')
      expect(s.release).toHaveBeenCalledTimes(1)
      expect(s.agents.relaunches[0]?.opts).toEqual({ mode: 'terminal' })
    })
  })
})
