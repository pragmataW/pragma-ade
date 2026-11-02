import type { LaunchSpec } from '@pragma/module-agents/contract'
import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createCliLaunchDecorator, prependPathEntry } from '../src/main/launch-decorator'
import type { CliPaths } from '../src/main/paths'

const paths: CliPaths = {
  bundlePath: '/res/pragma.cjs',
  skillsDir: '/res/skills',
  binDir: '/ud/modules/cli-integration/bin',
  shimPath: '/ud/modules/cli-integration/bin/pragma',
  bridgeFile: '/ud/bridge.json',
  execPath: '/app/Electron',
}
const spec = (env: Record<string, string> = {}): LaunchSpec => ({ command: 'agent', args: ['--x'], env, cwd: '/w' })
const decorator = (platform: NodeJS.Platform = 'darwin', basePath = async () => '/from/shell') =>
  createCliLaunchDecorator({ paths, platform, basePath })

describe('cli launch decorator', () => {
  it('prepends binDir to an existing PATH', async () => {
    const out = await decorator().decorate(spec({ PATH: '/a:/b' }), makeLaunchContext())
    expect(out.env.PATH).toBe(`${paths.binDir}:/a:/b`)
  })

  it('does not duplicate the entry', () => {
    expect(prependPathEntry(`/a:${paths.binDir}:/b`, paths.binDir, ':')).toBe(`${paths.binDir}:/a:/b`)
  })

  it.each([
    ['uses ctx.env PATH when spec.env has none', { env: { PATH: '/ctx' } }, `${paths.binDir}:/ctx`],
    ['then the launch shell env', { env: {}, shellEnv: { PATH: '/shell' } }, `${paths.binDir}:/shell`],
    ['falls back to basePath()', { env: {}, shellEnv: {} }, `${paths.binDir}:/from/shell`],
  ])('%s', async (_name, ctx, expected) => {
    expect((await decorator().decorate(spec(), makeLaunchContext(ctx))).env.PATH).toBe(expected)
  })

  it('preserves the Windows "Path" key', async () => {
    const out = await decorator('win32').decorate(spec({ Path: 'C:\\a' }), makeLaunchContext({ shellEnv: {} }))
    expect(out.env).toMatchObject({ Path: `${paths.binDir};C:\\a` })
    expect(out.env.PATH).toBeUndefined()
  })

  it('sets PRAGMA_CLI and PRAGMA_BRIDGE_FILE and keeps other env', async () => {
    const out = await decorator().decorate(spec({ A: '1' }), makeLaunchContext())
    expect(out.env).toMatchObject({ A: '1', PRAGMA_CLI: paths.shimPath, PRAGMA_BRIDGE_FILE: paths.bridgeFile })
  })

  it('env-only: the output spec equals the input spec except env', async () => {
    const input = spec({ A: '1' })
    const { env: _env, ...rest } = await decorator().decorate(input, makeLaunchContext())
    const { env: _inEnv, ...inputRest } = input
    expect(rest).toEqual(inputRest)
  })
})
