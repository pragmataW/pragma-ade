/** Test helpers for this and other modules' tests (`@pragma/module-agents/testing`, test code only). */
import type { CapabilityContext, Logger } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import {
  type AgentProfile,
  type AgentSession,
  type LaunchCapability,
  type LaunchContext,
  launchSpecSchema,
  TERMINAL_MODE,
} from '../src/contract'

export * from './fake-agent'

/** A complete profile with sensible defaults. */
export function aProfile(over: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'p1',
    providerId: 'prov',
    name: 'Agent',
    displayNameKey: null,
    commandOverride: null,
    argsOverride: null,
    command: 'agent',
    args: ['--x'],
    stockCommand: null,
    stockArgs: null,
    env: {},
    enabled: true,
    isDefault: false,
    isBuiltin: false,
    sortOrder: 0,
    available: true,
    ...over,
  }
}

/** A complete session with sensible defaults (worktree `w1`, terminal mode, starting). */
export function aSession(id: string, ordinal: number, over: Partial<AgentSession> = {}): AgentSession {
  return {
    id,
    worktreeId: 'w1',
    profileId: 'p1',
    providerId: 'prov',
    mode: TERMINAL_MODE,
    ptyId: null,
    title: id,
    ordinal,
    status: 'starting',
    externalSessionId: null,
    exitCode: null,
    error: null,
    createdAt: ordinal,
    endedAt: null,
    closedAt: null,
    lastFocusedAt: null,
    attachable: false,
    ...over,
  }
}

/** A launch context (worktree `/w`, temp dir `/tmp/s`) whose `writeTempFile` is recorded in `written`. */
export function makeLaunchContext(
  overrides: Partial<LaunchContext> = {},
): LaunchContext & { written: [string, string][] } {
  const written: [string, string][] = []
  const tempDir = overrides.tempDir ?? '/tmp/s'
  return {
    profile: aProfile(),
    worktreePath: '/w',
    worktreeId: 'wt1',
    sessionId: 's1',
    env: { A: '1' },
    mode: TERMINAL_MODE,
    shellEnv: { PATH: '/usr/bin' },
    tempDir,
    async writeTempFile(name, contents) {
      written.push([name, contents])
      return `${tempDir}/${name}`
    },
    ...overrides,
    written,
  }
}

const noop = (): void => undefined
const silentLogger = (): Logger => ({ debug: noop, info: noop, warn: noop, error: noop, child: () => silentLogger() })

/** A capability factory context that logs nowhere and resolves nothing. */
export function fakeCapabilityContext(over: Partial<CapabilityContext> = {}): CapabilityContext {
  return {
    log: silentLogger(),
    paths: { data: '/data', temp: '/tmp', resource: (rel) => `/res/${rel}` },
    getShellEnv: async () => ({ PATH: '/usr/bin' }),
    resolveCommand: async () => null,
    settings: { get: () => ({}), set: noop, update: noop, onChange: () => ({ dispose: noop }) },
    ...over,
  }
}

/** Shared conformance suite every provider's `launch` capability passes. */
export function describeLaunchCapability(name: string, create: (capCtx: CapabilityContext) => LaunchCapability): void {
  describe(`${name} launch capability conformance`, () => {
    const build = (o: Partial<LaunchContext> = {}) => create(fakeCapabilityContext()).buildLaunch(makeLaunchContext(o))
    it('no prompt → args contain the profile args', async () => {
      const spec = await build()
      expect(spec.args).toEqual(expect.arrayContaining(['--x']))
      expect(spec.command).toBe('agent')
    })
    it('cwd is the worktree', async () => expect((await build()).cwd).toBe('/w'))
    it('env equals ctx.env and is a copy', async () => {
      const ctx = makeLaunchContext()
      const spec = await create(fakeCapabilityContext()).buildLaunch(ctx)
      expect(spec.env).toEqual(ctx.env)
      expect(spec.env).not.toBe(ctx.env)
    })
    it('blank prompt adds nothing', async () =>
      expect((await build({ initialPrompt: '  \n' })).args).toEqual((await build()).args))
    it('result passes launchSpecSchema', async () =>
      expect(launchSpecSchema.safeParse(await build({ initialPrompt: 'Fix it' })).success).toBe(true))
  })
}
