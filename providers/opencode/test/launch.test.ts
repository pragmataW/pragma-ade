import type { CompatibilityContext, LaunchContext } from '@pragma/module-agents/contract'
import {
  aProfile,
  describeLaunchCapability,
  fakeCapabilityContext,
  makeLaunchContext,
} from '@pragma/module-agents/testing'
import { expect, it, vi } from 'vitest'
import { createLaunchCapability } from '../src/main/launch.capability'

describeLaunchCapability('opencode', createLaunchCapability)

const cap = createLaunchCapability(fakeCapabilityContext())
const argsFor = async (o: Partial<LaunchContext>) => (await cap.buildLaunch(makeLaunchContext(o))).args

it('opencode: standalone by default', async () => expect(await argsFor({})).toEqual(['--standalone', '--x']))

it('prompt uses the two-argv --prompt form', async () =>
  expect(await argsFor({ initialPrompt: 'Fix it' })).toEqual(['--standalone', '--x', '--prompt', 'Fix it']))

it.each([[['--standalone']], [['--server', 'http://h']], [['--server=http://h']]])(
  'opencode: no extra --standalone when the profile sets --standalone or --server (%j)',
  async (args) => expect(await argsFor({ profile: aProfile({ args }) })).toEqual(args),
)

it('opencode: no --standalone when resuming into a server', async () => {
  expect(await argsFor({ resume: { externalSessionId: 'ses_1', serverUrl: 'http://127.0.0.1:4096' } })).toEqual(['--x'])
  expect(await argsFor({ resume: { externalSessionId: 'ses_1' } })).toEqual(['--standalone', '--x'])
})

it('opencode: leading dash prompt', async () =>
  expect(await argsFor({ initialPrompt: '-x' })).toEqual(['--standalone', '--x', '--prompt', ' -x']))

it('opencode: prompt with "=" stays one argv element', async () => {
  const args = await argsFor({ initialPrompt: 'set a=b=c' })
  expect(args.slice(-2)).toEqual(['--prompt', 'set a=b=c'])
  expect(args.some((a) => a.startsWith('--prompt='))).toBe(false)
})

it('no positional directory is added', async () => {
  const args = await argsFor({ initialPrompt: 'Fix it' })
  expect(args).not.toContain('/w')
  expect(args).toHaveLength(4)
})

const compat = (stdout: string, exitCode: number | null = 0) => {
  const exec = vi.fn(async () => ({ exitCode, stdout, stderr: '' }))
  const ctx: CompatibilityContext = { profile: aProfile(), resolvedCommand: '/bin/opencode', exec }
  return { exec, result: cap.checkCompatibility?.(ctx) }
}

it.each([
  ['1.1.36\n', 0, { ok: false, reasonKey: 'opencode:launch.minVersion', params: { required: '2.x', found: '1.1.36' } }],
  ['opencode v2.2.5', 0, { ok: true, version: '2.2.5' }],
  ['', 0, { ok: true }],
  ['', null, { ok: true }],
])('compatibility of %j (exit %s)', async (stdout, exitCode, expected) => {
  const { exec, result } = compat(stdout, exitCode)
  expect(await result).toEqual(expected)
  expect(exec.mock.calls).toEqual([[['--version']]])
})

it('seeds the second built-in profile', () => expect(cap.seed?.order).toBe(20))
