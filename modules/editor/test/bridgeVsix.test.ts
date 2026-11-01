import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ensureBridgeExtension, locateBridgeVsix } from '../src/main/server/bridgeVsix'
import { tempDir } from './support/httpFixture'

const tmp = tempDir()
afterAll(() => tmp.cleanup())
let n = 0

function vsixAt(dir: string, version = '0.1.0', sha = 'aa') {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'pragma-bridge.vsix'), 'zip')
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version, sha256: sha }))
  return join(dir, 'pragma-bridge.vsix')
}

describe('locateBridgeVsix', () => {
  const resourceRoot = join(tmp.dir, 'module')
  const resource = (rel: string) => join(resourceRoot, rel)
  vsixAt(join(resourceRoot, 'packages/bridge-extension/dist'), '0.1.0', 'res')
  const override = vsixAt(join(tmp.dir, 'override'), '9.9.9', 'ovr')

  it('uses the env override only in testMode, else the ctx.paths.resource path', () => {
    const env = { PRAGMA_EDITOR_BRIDGE_VSIX: override }
    expect(locateBridgeVsix({ env, testMode: true, resource })).toEqual({
      vsix: override,
      version: '9.9.9',
      sha256: 'ovr',
    })
    expect(locateBridgeVsix({ env, testMode: false, resource })).toMatchObject({ version: '0.1.0', sha256: 'res' })
  })

  it('missing vsix → null', () => {
    expect(locateBridgeVsix({ env: {}, testMode: false, resource: (r) => join(tmp.dir, 'nothing', r) })).toBeNull()
  })
})

describe('ensureBridgeExtension', () => {
  function setup() {
    const root = join(tmp.dir, `ext-${++n}`)
    const dirs = {
      serverDataDir: join(root, 'server'),
      userDataDir: join(root, 'data'),
      extensionsDir: join(root, 'ext'),
    }
    const runs: string[][] = []
    let code = 0
    const run = async (args: string[]) => {
      runs.push(args)
      if (code === 0) {
        const version = args[1]?.includes('v2') ? '0.2.0' : '0.1.0'
        mkdirSync(join(dirs.extensionsDir, `pragma.pragma-bridge-${version}`), { recursive: true })
      }
      return { code, stderr: code ? 'boom' : '' }
    }
    const opts = (vsix = { vsix: '/x/v1/pragma-bridge.vsix', version: '0.1.0', sha256: 'aa' }) => ({
      vsix,
      markerFile: join(root, 'bridge-extension.json'),
      run,
      dirs,
    })
    return { runs, opts, fail: () => (code = 1) }
  }

  it('installs when marker missing, skips when marker+dir match, reinstalls on version change', async () => {
    const s = setup()
    expect(await ensureBridgeExtension(s.opts())).toBe('installed')
    expect(await ensureBridgeExtension(s.opts())).toBe('upToDate')
    expect(
      await ensureBridgeExtension(s.opts({ vsix: '/x/v2/pragma-bridge.vsix', version: '0.2.0', sha256: 'bb' })),
    ).toBe('installed')
    expect(s.runs).toHaveLength(2)
    expect(s.runs[0]?.slice(0, 3)).toEqual(['--install-extension', '/x/v1/pragma-bridge.vsix', '--force'])
  })

  it('throws on non-zero exit', async () => {
    const s = setup()
    s.fail()
    await expect(ensureBridgeExtension(s.opts())).rejects.toThrow('extensionInstallFailed')
  })
})
