import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KILL_CONFIRM_MS, STOP_GRACE_MS } from '../../src/constants'
import {
  type AgentSession,
  type AgentSessionModeHandler,
  AgentsError,
  type LaunchContext,
  TERMINAL_MODE,
} from '../../src/contract'
import { perTestDb } from '../support/db'
import { decorator } from '../support/fakes'
import { makeService, type ServiceHarness } from '../support/service'

const db = perTestDb()
afterEach(() => vi.useRealTimers())

const errorOf = (code: string) => new AgentsError(code as never).message
const withProfile = (h: ServiceHarness) => {
  h.profiles.update('builtin:claude', { args: '--a', env: { FOO: 'bar' } })
  return h
}
const start = (
  h: ServiceHarness,
  over: Parameters<ServiceHarness['service']['startSession']>[0] = { worktreeId: 'w1' },
) => h.service.startSession(over)
const ptyOf = (s: AgentSession) => s.ptyId as string
/** Fake timers for the stop windows only; real I/O (temp-dir cleanup) still runs. */
const fakeStopTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
const realTick = () => new Promise<void>((resolve) => setImmediate(resolve))
/** Fires the pty exit and waits (on real ticks) until the service recorded it. */
async function exitAndSettle(h: ServiceHarness, s: AgentSession, code: number | null = 0) {
  h.pty.exit(ptyOf(s), code)
  for (let i = 0; i < 200 && (await h.service.getSession(s.id))?.status !== 'exited'; i++) await realTick()
}

describe('launch basics', () => {
  it('starts default profile in worktree cwd with args and env', async () => {
    const h = withProfile(makeService(db()))
    const s = await start(h, { worktreeId: 'w1', initialPrompt: 'Fix it' })
    const [spawn] = h.pty.spawns
    expect(spawn?.opts).toMatchObject({
      cwd: '/repo',
      command: '/bin/claude',
      args: ['--a', 'Fix it'],
      cols: 120,
      rows: 32,
    })
    expect(spawn?.opts.env).toMatchObject({ PATH: '/usr/bin', HOME: '/home/u', FOO: 'bar', PRAGMA_SESSION_ID: s.id })
    expect(spawn?.opts.env?.PRAGMA_WORKTREE_ID).toBe('w1')
    expect(s).toMatchObject({ status: 'starting', attachable: true, ptyId: spawn?.ptyId, mode: TERMINAL_MODE })
    expect(h.events.named('agentSession.started')).toEqual([
      {
        sessionId: s.id,
        worktreeId: 'w1',
        profileId: 'builtin:claude',
        providerId: 'claude',
        mode: 'terminal',
        ptyId: spawn?.ptyId,
      },
    ])
    expect(h.notified[0]).toMatchObject({ id: s.id, reveal: true })
  })

  it('title derives from prompt, else "Session N"', async () => {
    const h = makeService(db())
    expect((await start(h, { worktreeId: 'w1', initialPrompt: '  Fix the\nbug' })).title).toBe('Fix the')
    expect((await start(h)).title).toBe('agents:session.untitled#2')
  })
})

describe('exit and errors', () => {
  it('exit marks exited, emits exited + updated, cleans temp dir', async () => {
    const h = makeService(db())
    const s = await start(h)
    const dir = join(db().dir, 'agents', 'tmp', s.id)
    expect(existsSync(dir)).toBe(true)
    h.pty.exit(ptyOf(s), 3)
    await vi.waitFor(async () => expect((await h.service.getSession(s.id))?.status).toBe('exited'))
    expect(await h.service.getSession(s.id)).toMatchObject({ exitCode: 3 })
    expect(h.events.named('agentSession.exited')).toEqual([{ sessionId: s.id, worktreeId: 'w1', exitCode: 3 }])
    expect(h.events.named('agentSession.updated').at(-1)).toMatchObject({ changed: expect.arrayContaining(['status']) })
    expect(existsSync(dir)).toBe(false)
  })

  it('daemon exit without code marks exited', async () => {
    const h = makeService(db())
    const s = await start(h)
    h.pty.exit(ptyOf(s), null, 'daemon-restarted')
    await vi.waitFor(async () =>
      expect(await h.service.getSession(s.id)).toMatchObject({ status: 'exited', exitCode: null }),
    )
  })

  it('unavailable provider gives an error session', async () => {
    const h = makeService(db(), { providers: [{ id: 'claude', command: 'claude', seed: 10 }] })
    const off = makeService(db(), { providers: [{ id: 'claude', command: 'claude', noLaunch: true }] })
    expect(off.profiles.get('builtin:claude')?.available).toBe(false)
    const s = await off.service.startSession({ worktreeId: 'w1', profileId: 'builtin:claude' })
    expect(s).toMatchObject({ status: 'error', error: { code: 'providerUnavailable' }, attachable: false })
    expect(s.endedAt).not.toBeNull()
    expect(off.pty.spawns).toEqual([])
    expect(h.pty.spawns).toEqual([])
  })

  it('command not found gives error session', async () => {
    const h = makeService(db())
    h.profiles.update('builtin:claude', { command: 'missing' })
    const s = await start(h)
    expect(s).toMatchObject({ status: 'error', error: { code: 'commandNotFound' } })
    expect(s.error?.message).toBe('agents:errors.commandNotFound|{"command":"missing"}')
  })

  it('spawn failure gives a spawnFailed error session', async () => {
    const h = makeService(db())
    h.pty.failNextSpawn(new Error('no cwd'))
    expect(await start(h)).toMatchObject({ status: 'error', error: { code: 'spawnFailed' } })
  })

  it.each([
    [
      'profileDisabled',
      (h: ServiceHarness) => {
        h.profiles.update('builtin:opencode', { enabled: false })
        return start(h, { worktreeId: 'w1', profileId: 'builtin:opencode' })
      },
    ],
    ['modeUnavailable', (h: ServiceHarness) => start(h, { worktreeId: 'w1', mode: 'chat' })],
    ['worktreeNotFound', (h: ServiceHarness) => start(h, { worktreeId: 'nope' })],
    ['profileNotFound', (h: ServiceHarness) => start(h, { worktreeId: 'w1', profileId: 'nope' })],
  ])('startSession rejects %s', async (code, act) => {
    const h = makeService(db())
    await expect(act(h)).rejects.toThrow(errorOf(code))
    expect(await h.service.listSessions('w1')).toEqual([])
  })
})

describe('mode handlers and decorators', () => {
  const chatHandler = (): AgentSessionModeHandler & { starts: number } => {
    const h = {
      starts: 0,
      async start() {
        h.starts++
        return { ptyId: null }
      },
      async stop() {},
    }
    return h
  }

  it('registerModeHandler routes by mode and rejects duplicates', async () => {
    const h = makeService(db())
    const chat = chatHandler()
    const off = h.service.registerModeHandler('chat', chat)
    expect(() => h.service.registerModeHandler('chat', chatHandler())).toThrow(/already registered/)
    expect(h.service.listModes()).toEqual(['terminal', 'chat'])
    const s = await start(h, { worktreeId: 'w1', mode: 'chat' })
    expect([chat.starts, h.pty.spawns.length, s.mode]).toEqual([1, 0, 'chat'])
    off()
    expect(h.service.listModes()).toEqual(['terminal'])
  })

  it('resume reaches decorators via LaunchContext', async () => {
    const h = makeService(db())
    const seen: (LaunchContext['resume'] | undefined)[] = []
    h.service.registerLaunchDecorator(
      decorator('rec', 1, (spec, ctx) => {
        seen.push(ctx.resume)
        return spec
      }),
    )
    const s = await start(h)
    h.pty.exit(ptyOf(s), 0)
    await vi.waitFor(async () => expect((await h.service.getSession(s.id))?.status).toBe('exited'))
    await h.service.relaunchSession(s.id, { resume: { externalSessionId: 'X' } })
    expect(seen.map((r) => r?.externalSessionId)).toEqual([undefined, 'X'])
  })

  it('buildLaunchEnv merges decorator env over shell env for an existing session', async () => {
    const h = makeService(db())
    h.service.registerLaunchDecorator(
      decorator('bridge', 1, (spec) => ({ ...spec, env: { ...spec.env, PRAGMA_BRIDGE_URL: 'ws://b' } })),
    )
    const s = await start(h)
    const env = await h.service.buildLaunchEnv({ sessionId: s.id })
    expect(env).toMatchObject({ PATH: '/usr/bin', PRAGMA_BRIDGE_URL: 'ws://b', PRAGMA_SESSION_ID: s.id })
  })

  it('buildLaunchEnv unknown session → sessionNotFound', async () => {
    await expect(makeService(db()).service.buildLaunchEnv({ sessionId: 'nope' })).rejects.toThrow(
      errorOf('sessionNotFound'),
    )
  })
})

describe('lifecycle', () => {
  type Step = 'term' | 'kill' | 'never'
  it.each<[Step, string[]]>([
    ['term', ['SIGTERM']],
    ['kill', ['SIGTERM', 'SIGKILL']],
    ['never', ['SIGTERM', 'SIGKILL']],
  ])('stopSession escalation: exit after %s', async (exitAfter, signals) => {
    fakeStopTimers()
    const h = makeService(db())
    const s = await start(h)
    const stopped = h.service.stopSession(s.id)
    const outcome = stopped.then(
      () => 'resolved',
      (e: Error) => e.message,
    )
    await vi.advanceTimersByTimeAsync(0)
    if (exitAfter === 'term') await exitAndSettle(h, s)
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS)
    if (exitAfter === 'kill') await exitAndSettle(h, s, null)
    await vi.advanceTimersByTimeAsync(KILL_CONFIRM_MS)
    expect(await outcome).toBe(exitAfter === 'never' ? errorOf('stopFailed') : 'resolved')
    expect(h.pty.signals).toEqual(signals)
    if (exitAfter === 'never')
      expect(await h.service.getSession(s.id)).toMatchObject({ status: 'starting', endedAt: null })
  })

  it('stopSession never resolves before exit', async () => {
    fakeStopTimers()
    const h = makeService(db())
    const s = await start(h)
    let state = 'pending'
    h.service.stopSession(s.id).then(
      () => (state = 'resolved'),
      () => (state = 'rejected'),
    )
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + KILL_CONFIRM_MS - 1)
    expect(state).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    expect(state).toBe('rejected')
  })

  it('concurrent stopSession calls share one escalation', async () => {
    const h = makeService(db())
    const s = await start(h)
    const both = Promise.all([h.service.stopSession(s.id), h.service.stopSession(s.id)])
    await vi.waitFor(() => expect(h.pty.signals).toEqual(['SIGTERM']))
    h.pty.exit(ptyOf(s), 0)
    await both
    expect(h.pty.signals).toEqual(['SIGTERM'])
  })

  it('stopSession of an ended session resolves at once', async () => {
    const h = makeService(db())
    h.profiles.update('builtin:claude', { command: 'missing' })
    const s = await start(h)
    await h.service.stopSession(s.id)
    expect(h.pty.signals).toEqual([])
  })

  it('newWorktree creates the worktree via ProjectsService and launches there', async () => {
    const h = makeService(db())
    const s = await start(h, { worktreeId: 'w1', newWorktree: { branch: 'agent/x', baseBranch: 'main' } })
    expect(h.projects.created).toEqual([{ projectId: 'proj1', branch: 'agent/x', baseBranch: 'main' }])
    expect(h.pty.spawns[0]?.opts.cwd).toBe('/wt/agent/x')
    expect(s.worktreeId).toBe('w-agent/x')
  })

  it('createWorktree failure throws worktreeCreateFailed and creates no row', async () => {
    const h = makeService(db())
    h.projects.failCreate(new Error('branch exists'))
    await expect(start(h, { worktreeId: 'w1', newWorktree: { branch: 'agent/x' } })).rejects.toThrow(
      'agents:errors.worktreeCreateFailed|{"message":"branch exists"}',
    )
    expect(await h.service.listSessions('w1')).toEqual([])
  })

  it('relaunchSession waits for the old process to exit before spawning', async () => {
    const h = makeService(db())
    const s = await start(h)
    const relaunched = h.service.relaunchSession(s.id)
    await vi.waitFor(() => expect(h.pty.signals).toEqual(['SIGTERM']))
    expect(h.pty.spawns).toHaveLength(1)
    h.pty.exit(ptyOf(s), 0)
    const r = await relaunched
    expect(h.pty.spawns).toHaveLength(2)
    expect(r).toMatchObject({
      id: s.id,
      status: 'starting',
      ptyId: h.pty.spawns[1]?.ptyId,
      exitCode: null,
      endedAt: null,
    })
  })

  it('relaunchSession with no exit rejects stopFailed and spawns nothing', async () => {
    fakeStopTimers()
    const h = makeService(db())
    const s = await start(h)
    const outcome = h.service.relaunchSession(s.id).catch((e: Error) => e.message)
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + KILL_CONFIRM_MS)
    expect(await outcome).toBe(errorOf('stopFailed'))
    expect(h.pty.spawns).toHaveLength(1)
  })

  it('closeSession keeps the tab when stop fails', async () => {
    fakeStopTimers()
    const h = makeService(db())
    const s = await start(h)
    const outcome = h.service.closeSession(s.id).catch((e: Error) => e.message)
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS + KILL_CONFIRM_MS)
    expect(await outcome).toBe(errorOf('stopFailed'))
    expect((await h.service.listSessions('w1')).map((x) => x.id)).toEqual([s.id])
  })

  it('closeSession stops and hides', async () => {
    const h = makeService(db())
    const s = await start(h)
    const closing = h.service.closeSession(s.id)
    await vi.waitFor(() => expect(h.pty.signals).toEqual(['SIGTERM']))
    h.pty.exit(ptyOf(s), 0)
    await closing
    expect(await h.service.listSessions('w1')).toEqual([])
    expect((await h.service.listSessions('w1', { includeClosed: true }))[0]?.closedAt).not.toBeNull()
  })

  it('relaunchSession reuses the row and can switch mode', async () => {
    const h = makeService(db())
    h.service.registerModeHandler('chat', { start: async () => ({ ptyId: null }), stop: async () => {} })
    const s = await start(h)
    h.pty.exit(ptyOf(s), 0)
    await vi.waitFor(async () => expect((await h.service.getSession(s.id))?.status).toBe('exited'))
    const r = await h.service.relaunchSession(s.id, { mode: 'chat' })
    expect(r).toMatchObject({ id: s.id, mode: 'chat', ordinal: 1, ptyId: null })
    expect(h.pty.spawns).toHaveLength(1)
  })

  it('updateSession persists, emits agentSession.updated with changed keys', async () => {
    const h = makeService(db())
    const s = await start(h)
    const u = await h.service.updateSession(s.id, { status: 'working', externalSessionId: 'ext-1' })
    expect(u).toMatchObject({ status: 'working', externalSessionId: 'ext-1' })
    expect(h.events.named('agentSession.updated').at(-1)).toEqual({
      session: u,
      changed: ['status', 'externalSessionId'],
    })
    expect(h.notified.at(-1)).toMatchObject({ id: s.id, status: 'working', reveal: false })
  })

  it('updateSession unknown id throws sessionNotFound', async () => {
    await expect(makeService(db()).service.updateSession('nope', { status: 'idle' })).rejects.toThrow(
      errorOf('sessionNotFound'),
    )
  })
})

describe('queries', () => {
  it('getLastFocusedSession', async () => {
    const h = makeService(db())
    const a = await start(h)
    const b = await start(h)
    expect((await h.service.getLastFocusedSession('w1'))?.id).toBe(b.id)
    await h.service.focusSession(a.id)
    expect((await h.service.getLastFocusedSession('w1'))?.id).toBe(a.id)
  })

  it('attachable false for rows from a previous run', async () => {
    const h = makeService(db())
    const s = await start(h)
    const next = makeService(db())
    await next.service.markAllEndedOnStartup()
    expect(await next.service.getSession(s.id)).toMatchObject({ status: 'exited', attachable: false, exitCode: null })
  })
})
