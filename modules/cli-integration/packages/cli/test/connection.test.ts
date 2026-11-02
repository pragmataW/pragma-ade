import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BRIDGE_ENV } from '@pragma/module-bridge/client'
import { USER_DATA_ENV } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import { NotRunningError, resolveBridgeEndpoint } from '../src/connection'
import { TEST_TOKEN, tempDir, writeBridgeFile } from './support/bridge-file'

const URLS = { env: 'http://127.0.0.1:1001', file: 'http://127.0.0.1:1002', userData: 'http://127.0.0.1:1003' }

/** Every discovery source present except the ones listed in `drop`. */
function setup(drop: ('env' | 'file' | 'userData')[]) {
  const root = tempDir()
  const home = join(root, 'home')
  const env: NodeJS.ProcessEnv = {}
  if (!drop.includes('env')) Object.assign(env, { [BRIDGE_ENV.url]: URLS.env, [BRIDGE_ENV.token]: TEST_TOKEN })
  if (!drop.includes('file')) env[BRIDGE_ENV.file] = writeBridgeFile(join(root, 'f'), URLS.file, 'custom.json')
  if (!drop.includes('userData')) {
    env[USER_DATA_ENV] = join(root, 'ud')
    writeBridgeFile(env[USER_DATA_ENV], URLS.userData)
  }
  return { env, home }
}

describe('resolveBridgeEndpoint', () => {
  it.each([
    ['env pair wins over PRAGMA_BRIDGE_FILE', [], URLS.env],
    ['PRAGMA_BRIDGE_FILE wins over PRAGMA_USER_DATA', ['env'], URLS.file],
    ['PRAGMA_USER_DATA/bridge.json used last', ['env', 'file'], URLS.userData],
  ] as const)('%s', async (_name, drop, url) => {
    const { env, home } = setup([...drop])
    expect(await resolveBridgeEndpoint(env, { home })).toEqual({ url, token: TEST_TOKEN })
  })

  it('nothing → NotRunningError', async () => {
    const { env, home } = setup(['env', 'file', 'userData'])
    await expect(resolveBridgeEndpoint(env, { home })).rejects.toThrow(NotRunningError)
    await expect(resolveBridgeEndpoint(env, { home })).rejects.toThrow('no bridge info found')
  })

  it('PRAGMA_BRIDGE_FILE to a missing file → hint names the file', async () => {
    const { env, home } = setup(['env', 'userData'])
    const missing = join(home, 'missing.json')
    env[BRIDGE_ENV.file] = missing
    const err = await resolveBridgeEndpoint(env, { home }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotRunningError)
    expect((err as NotRunningError).hint).toContain(missing)
  })

  it('malformed file → NotRunningError with the file in the hint', async () => {
    const { env, home } = setup(['env', 'userData'])
    writeFileSync(env[BRIDGE_ENV.file] as string, '{not json')
    const err = await resolveBridgeEndpoint(env, { home }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NotRunningError)
    expect((err as NotRunningError).hint).toContain(env[BRIDGE_ENV.file])
  })
})
