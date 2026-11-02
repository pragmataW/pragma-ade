import { describe, expect, it } from 'vitest'
import { PINNED_RELEASE } from '../src/main/release/release'
import { installExtensionArgs, serverCommand, startArgs } from '../src/main/server/args'

const dirs = {
  serverDataDir: '/ud/editor/server',
  userDataDir: '/ud/editor/data',
  extensionsDir: '/ud/editor/extensions',
}
const TOKEN = 'secret-token-value'

describe('server argv', () => {
  it('startArgs exact argv', () => {
    expect(startArgs({ port: 4711, tokenFile: '/ud/editor/connection-token', dirs, graceSeconds: 300 })).toEqual([
      '--host',
      '127.0.0.1',
      '--port',
      '4711',
      '--connection-token-file',
      '/ud/editor/connection-token',
      '--accept-server-license-terms',
      '--telemetry-level',
      'off',
      '--disable-workspace-trust',
      '--server-data-dir',
      '/ud/editor/server',
      '--user-data-dir',
      '/ud/editor/data',
      '--extensions-dir',
      '/ud/editor/extensions',
      '--reconnection-grace-time',
      '300',
    ])
  })

  it('installExtensionArgs exact argv', () => {
    expect(installExtensionArgs({ vsix: '/x/pragma-bridge.vsix', dirs })).toEqual([
      '--install-extension',
      '/x/pragma-bridge.vsix',
      '--force',
      '--accept-server-license-terms',
      '--server-data-dir',
      '/ud/editor/server',
      '--user-data-dir',
      '/ud/editor/data',
      '--extensions-dir',
      '/ud/editor/extensions',
    ])
  })

  it('no token value ever appears in argv', () => {
    const argv = startArgs({ port: 1, tokenFile: '/t', dirs, graceSeconds: 10 })
    expect(argv.join(' ')).not.toContain(TOKEN)
    expect(argv).not.toContain('--connection-token')
  })

  it.each([
    ['win32', true, 'bin/codium-server.cmd'],
    ['darwin', false, 'bin/codium-server'],
  ] as const)('serverCommand %s', (platform, shell, bin) => {
    const c = serverCommand('/inst', PINNED_RELEASE, platform)
    expect(c.shell).toBe(shell)
    expect(c.command.replaceAll('\\', '/')).toBe(`/inst/${bin}`)
  })
})
