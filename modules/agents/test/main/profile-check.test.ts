import { realpathSync } from 'node:fs'
import { FAKE_AGENT_ENV, fakeAgentCommand } from '@pragma/module-agents/testing'
import { expect, it, vi } from 'vitest'
import type { CompatibilityContext, LaunchCapability } from '../../src/contract'
import { createProfileChecker } from '../../src/main/launch/profile-check'
import { createResolve } from '../../src/main/launch/resolve'
import { ProfilesStore } from '../../src/main/profiles/profiles-store'
import { DEFAULT_PROVIDERS, makeProviders, storeDeps } from '../support/builders'
import { perTestDb } from '../support/db'
import { recordingLog } from '../support/fakes'

const db = perTestDb()

function setup(check?: LaunchCapability['checkCompatibility'], resolved: string | null = '/bin/opencode') {
  const providers = makeProviders(
    DEFAULT_PROVIDERS.map((d) => (d.id === 'opencode' ? { ...d, checkCompatibility: check } : d)),
  )
  const profiles = new ProfilesStore(db().db, providers, storeDeps())
  profiles.ensureBuiltinProfiles()
  let clock = 0
  const checker = createProfileChecker({
    profiles,
    providers,
    resolve: createResolve(async () => resolved),
    getShellEnv: async () => ({ PATH: process.env.PATH ?? '' }),
    log: recordingLog(),
    now: () => clock,
  })
  return { profiles, checker, tick: (ms: number) => (clock += ms) }
}

const minVersion = {
  ok: false,
  reasonKey: 'opencode:launch.minVersion',
  params: { required: '2.x', found: '1.1.36' },
} as const

it('minVersion result is returned', async () => {
  const { checker } = setup(async () => minVersion)
  expect(await checker.check('builtin:opencode')).toEqual({
    resolution: { status: 'found', path: '/bin/opencode' },
    compatibility: minVersion,
  })
})

it('no check → compatibility null', async () => {
  expect((await setup().checker.check('builtin:claude')).compatibility).toBeNull()
})

it('notFound skips the check', async () => {
  const check = vi.fn(async () => minVersion)
  expect(await setup(check, null).checker.check('builtin:opencode')).toEqual({
    resolution: { status: 'notFound' },
    compatibility: null,
  })
  expect(check).not.toHaveBeenCalled()
})

it('cached for the TTL', async () => {
  const check = vi.fn(async () => ({ ok: true as const }))
  const { checker, tick } = setup(check)
  await checker.check('builtin:opencode')
  tick(59_000)
  await checker.check('builtin:opencode')
  expect(check).toHaveBeenCalledTimes(1)
  tick(2000)
  await checker.check('builtin:opencode')
  expect(check).toHaveBeenCalledTimes(2)
})

it('real exec of the fake agent --version returns its output', async () => {
  const check = async (c: CompatibilityContext) => {
    const r = await c.exec(['--version'])
    return { ok: true as const, version: r.stdout.trim() }
  }
  const { checker, profiles } = setup(check, realpathSync(fakeAgentCommand()))
  profiles.update('builtin:opencode', { env: { [FAKE_AGENT_ENV.version]: '2.2.5' } })
  expect((await checker.check('builtin:opencode')).compatibility).toEqual({ ok: true, version: '2.2.5' })
})
