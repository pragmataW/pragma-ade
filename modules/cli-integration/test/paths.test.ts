import { describe, expect, it } from 'vitest'
import { resolveCliPaths } from '../src/main/paths'

function resolve(o: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform } = {}) {
  const requested: string[] = []
  const paths = resolveCliPaths({
    resource: (rel) => {
      requested.push(rel)
      return `/res/${rel}`
    },
    dataDir: '/ud/modules/cli-integration',
    userData: '/ud',
    execPath: '/app/Electron',
    platform: o.platform ?? 'darwin',
    env: o.env ?? {},
  })
  return { paths, requested }
}

describe('resolveCliPaths', () => {
  it('bundle and skills come from resource(rel)', () => {
    const { paths, requested } = resolve()
    expect(requested).toEqual(expect.arrayContaining(['packages/cli/dist/pragma.cjs', 'skills']))
    expect(paths).toMatchObject({
      bundlePath: '/res/packages/cli/dist/pragma.cjs',
      skillsDir: '/res/skills',
      binDir: '/ud/modules/cli-integration/bin',
      shimPath: '/ud/modules/cli-integration/bin/pragma',
      bridgeFile: '/ud/bridge.json',
      execPath: '/app/Electron',
    })
  })

  it.each([
    ['PRAGMA_CLI_BUNDLE override', { env: { PRAGMA_CLI_BUNDLE: '/custom.cjs' } }, 'bundlePath', '/custom.cjs'],
    [
      'win32 shim name pragma.cmd',
      { platform: 'win32' as const },
      'shimPath',
      '/ud/modules/cli-integration/bin/pragma.cmd',
    ],
  ] as const)('%s', (_name, o, key, value) => {
    expect(resolve(o).paths[key]).toBe(value)
  })
})
