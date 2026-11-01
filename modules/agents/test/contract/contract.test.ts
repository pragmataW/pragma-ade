import type { CapabilityMap } from '@pragma/sdk'
import { expect, expectTypeOf, it } from 'vitest'
import {
  AGENTS_IPC,
  AGENTS_TESTIDS,
  AgentsError,
  agentSessionStatuses,
  agentsErrorKey,
  agentsIpc,
  envSchema,
  isRunningStatus,
  type LaunchCapability,
  launchSpecSchema,
  startSessionInputSchema,
} from '../../src/contract'

it.each([
  [{ PRAGMA_X: '1' }, false],
  [{ '1A': 'x' }, false],
  [{ A: 'nul\0' }, false],
  [{ FOO_1: 'bar' }, true],
])('envSchema rejects PRAGMA_ keys and invalid names (%j)', (env, ok) =>
  expect(envSchema.safeParse(env).success).toBe(ok),
)

it('startSessionInputSchema defaults mode to terminal', () =>
  expect(startSessionInputSchema.parse({ worktreeId: 'w' }).mode).toBe('terminal'))

it('resume requires a non-empty id', () =>
  expect(startSessionInputSchema.safeParse({ worktreeId: 'w', resume: { externalSessionId: '' } }).success).toBe(false))

it('newWorktree requires a non-empty branch', () =>
  expect(startSessionInputSchema.safeParse({ worktreeId: 'w', newWorktree: { branch: '  ' } }).success).toBe(false))

it('launchSpecSchema rejects empty command and non-string env', () => {
  expect(launchSpecSchema.safeParse({ command: '', args: [], env: {}, cwd: '/w' }).success).toBe(false)
  expect(launchSpecSchema.safeParse({ command: 'a', args: [], env: { A: 1 }, cwd: '/w' }).success).toBe(false)
  expect(launchSpecSchema.safeParse({ command: 'a', args: [], env: {}, cwd: '/w' }).success).toBe(true)
})

it('AgentsError message carries key and params', () => {
  const e = new AgentsError('commandNotFound', { command: 'dgc' })
  expect(e.message).toBe('agents:errors.commandNotFound|{"command":"dgc"}')
  expect(agentsErrorKey(new Error(e.message))).toEqual({
    key: 'agents:errors.commandNotFound',
    params: { command: 'dgc' },
  })
  expect(agentsErrorKey(new AgentsError('stopFailed'))).toEqual({ key: 'agents:errors.stopFailed', params: {} })
  expect(agentsErrorKey(new Error('boom'))).toBeNull()
  expect(agentsErrorKey(new Error('agents:errors.notACode'))).toBeNull()
})

it.each(agentSessionStatuses.map((s) => [s, s !== 'exited' && s !== 'error'] as const))(
  'isRunningStatus(%s) = %s',
  (status, running) => expect(isRunningStatus(status)).toBe(running),
)

it('AGENTS_IPC has 18 unique channels prefixed agents.', () => {
  const channels = Object.values(AGENTS_IPC)
  expect(channels).toHaveLength(18)
  expect(new Set(channels).size).toBe(18)
  for (const c of channels) expect(c.startsWith('agents.')).toBe(true)
  expect(Object.values(agentsIpc).map((c) => c.channel)).toEqual(channels)
})

it('AGENTS_TESTIDS values are unique', () => {
  const ids = Object.values(AGENTS_TESTIDS)
  expect(new Set(ids).size).toBe(ids.length)
})

it('the launch capability is merged into CapabilityMap', () =>
  expectTypeOf<CapabilityMap['launch']>().toEqualTypeOf<LaunchCapability>())
