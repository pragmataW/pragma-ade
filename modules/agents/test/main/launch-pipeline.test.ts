import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { AgentsError, type LaunchSpec } from '../../src/contract'
import { LaunchDecoratorRegistry } from '../../src/main/launch/decorators'
import { runEnvPipeline, runLaunchPipeline } from '../../src/main/launch/launch-pipeline'
import { makeProviders } from '../support/builders'
import { decorator, recordingLog } from '../support/fakes'

const ctx = (providerId = 'claude') =>
  makeLaunchContext({
    profile: { ...makeLaunchContext().profile, providerId },
    shellEnv: { PATH: '/usr/bin', HOME: '/h' },
  })

function setup(...decorators: ReturnType<typeof decorator>[]) {
  const registry = new LaunchDecoratorRegistry()
  for (const d of decorators) registry.register(d)
  const log = recordingLog()
  const resolve = async (command: string) =>
    command === 'missing' ? ({ status: 'notFound' } as const) : ({ status: 'found', path: `/bin/${command}` } as const)
  return { log, deps: { providers: makeProviders(), decorators: registry, resolve, log } }
}

const withArg = (arg: string) => (s: LaunchSpec) => ({ ...s, args: [...s.args, arg] })

describe('runLaunchPipeline', () => {
  it('applies capability then decorators in order', async () => {
    const { deps } = setup(decorator('second', 20, withArg('b')), decorator('first', 10, withArg('a')))
    const out = await runLaunchPipeline(deps, ctx())
    expect(out.spec.args).toEqual(['--x', 'a', 'b'])
    expect(out.resolvedCommand).toBe('/bin/agent')
  })

  it('throwing decorator is skipped', async () => {
    const { deps, log } = setup(
      decorator('boom', 10, () => {
        throw new Error('bug')
      }),
      decorator('after', 20, withArg('later')),
    )
    expect((await runLaunchPipeline(deps, ctx())).spec.args).toEqual(['--x', 'later'])
    expect(log.warnings().join('\n')).toMatch(/boom/)
  })

  it('invalid spec from decorator is ignored', async () => {
    const { deps, log } = setup(
      decorator('bad', 10, (s) => ({ ...s, command: '' })),
      decorator('ok', 20, withArg('y')),
    )
    const out = await runLaunchPipeline(deps, ctx())
    expect(out.spec).toMatchObject({ command: 'agent', args: ['--x', 'y'] })
    expect(log.warnings().join('\n')).toMatch(/bad/)
  })

  it('decorator env additions are merged over shell env', async () => {
    const { deps } = setup(decorator('bridge', 10, (s) => ({ ...s, env: { ...s.env, PRAGMA_BRIDGE_URL: 'ws://x' } })))
    const out = await runLaunchPipeline(deps, ctx())
    expect(out.env).toEqual({ PATH: '/usr/bin', HOME: '/h', A: '1', PRAGMA_BRIDGE_URL: 'ws://x' })
    expect(out.spec.env).toEqual({ A: '1', PRAGMA_BRIDGE_URL: 'ws://x' })
  })

  it('missing capability → providerUnavailable', async () => {
    const { deps } = setup()
    await expect(runLaunchPipeline(deps, ctx('gone'))).rejects.toThrow(new AgentsError('providerUnavailable').message)
  })

  it('unresolvable command → commandNotFound', async () => {
    const { deps } = setup(decorator('rename', 10, (s) => ({ ...s, command: 'missing' })))
    await expect(runLaunchPipeline(deps, ctx())).rejects.toThrow('agents:errors.commandNotFound|{"command":"missing"}')
  })
})

it('buildLaunchEnv returns only env and survives a failing decorator', async () => {
  const { deps } = setup(
    decorator('path', 10, (s, c) => ({ ...s, args: ['changed'], env: { ...s.env, PATH: `/cli:${c.shellEnv.PATH}` } })),
    decorator('boom', 20, () => {
      throw new Error('bug')
    }),
  )
  expect(await runEnvPipeline(deps, ctx())).toEqual({ PATH: '/cli:/usr/bin', HOME: '/h', A: '1' })
})
