import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it, vi } from 'vitest'
import { LAUNCH_DECORATOR_ID } from '../src/constants'
import { cliIntegrationIpc } from '../src/contract'
import { activateModule } from './support/module-ctx'
import { makeSkillsFixture } from './support/skills'

describe('cli-integration main module', () => {
  it('writes the shim and registers the PATH decorator', async () => {
    const m = await activateModule()
    const shim = join(m.userData, 'modules', 'cli-integration', 'bin', 'pragma')
    expect(existsSync(shim)).toBe(true)
    expect(readFileSync(shim, 'utf8')).toContain('ELECTRON_RUN_AS_NODE=1 exec')
    expect(m.agents.state.decorators.map((d) => d.id)).toEqual([LAUNCH_DECORATOR_ID])
    const spec = await m.agents.state.decorators[0]?.decorate(
      { command: 'a', args: [], env: {}, cwd: '/w' },
      makeLaunchContext({ env: {}, shellEnv: { PATH: '/usr/bin' } }),
    )
    expect(spec?.env.PATH).toBe(`${join(m.userData, 'modules', 'cli-integration', 'bin')}:/usr/bin`)
  })

  it('serves cli.* on the bridge', async () => {
    const m = await activateModule()
    const res = await fetch(`${m.bridge.url}/hook`, {
      method: 'POST',
      headers: { authorization: `Bearer ${m.bridge.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'cli.profileList', payload: { context: { cwd: '/' } } }),
    })
    expect(await res.json()).toMatchObject({
      payload: { ok: true, result: { profiles: [{ id: 'claude' }, { id: 'oc' }] } },
    })
  })

  it('deactivate unregisters the decorator', async () => {
    const m = await activateModule()
    const { default: mainModule } = await import('../src/main')
    await mainModule.deactivate?.()
    expect(m.agents.state.decorators).toEqual([])
  })
})

describe('settings IPC', () => {
  it('getStatus reports the CLI under <home>/.local/bin as not installed', async () => {
    const m = await activateModule()
    const status = await m.fake.invoke(cliIntegrationIpc.getStatus, undefined)
    expect(status.cli).toMatchObject({ state: 'not_installed', bundleFound: true })
    expect(status.cli.linkPath.endsWith(join('.local', 'bin', 'pragma'))).toBe(true)
  })
})

describe('skills IPC', () => {
  it('lists missing targets, installs only the chosen provider and publishes the new status', async () => {
    const f = makeSkillsFixture()
    vi.stubEnv('HOME', f.home)
    const m = await activateModule({ skillProviders: f.providers })
    const before = await m.fake.invoke(cliIntegrationIpc.getStatus, undefined)
    expect(before.skills.map((s) => [s.providerId, s.state])).toEqual([
      ['alpha', 'missing'],
      ['alpha', 'missing'],
      ['alpha', 'missing'],
      ['beta', 'missing'],
      ['beta', 'missing'],
      ['beta', 'missing'],
    ])
    const after = await m.fake.invoke(cliIntegrationIpc.installSkills, { providerIds: ['alpha'] })
    expect(after.skills.map((s) => s.state)).toEqual(['current', 'current', 'current', 'missing', 'missing', 'missing'])
    expect(existsSync(join(f.home, '.alpha', 'skills', 'pragma-handoff', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(m.userData, 'modules', 'cli-integration', 'installed-skills.json'))).toBe(true)
    expect(m.fake.publishedOn(cliIntegrationIpc.statusChanged)).toEqual([after])
    vi.unstubAllEnvs()
  })
})
