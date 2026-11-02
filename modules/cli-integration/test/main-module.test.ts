import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { LAUNCH_DECORATOR_ID } from '../src/constants'
import { activateModule } from './support/module-ctx'

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
    expect(await res.json()).toMatchObject({ payload: { ok: true, result: { profiles: [{ id: 'claude' }, { id: 'oc' }] } } })
  })

  it('deactivate unregisters the decorator', async () => {
    const m = await activateModule()
    const { default: mainModule } = await import('../src/main')
    await mainModule.deactivate?.()
    expect(m.agents.state.decorators).toEqual([])
  })
})
