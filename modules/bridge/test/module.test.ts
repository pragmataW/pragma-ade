import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MainContext } from '@pragma/sdk/main'
import { createTestModuleHost, loadModuleRecord, memoryLogger, type TestModuleHost } from '@pragma/test-support'
import { afterEach, describe, expect, it } from 'vitest'
import { BRIDGE_INFO_FILE, BridgeInfoFileSchema, type BridgeServer, BridgeServerToken } from '../src/contract'
import mainModule from '../src/main/index'
import { bearer, postRaw } from './support/servers'
import { useTempDirs } from './support/tmp'

const tempDir = useTempDirs()
let t: TestModuleHost | undefined
afterEach(async () => {
  await t?.dispose()
  t = undefined
  await mainModule.deactivate?.()
})

const readInfo = (dir: string) =>
  BridgeInfoFileSchema.parse(JSON.parse(readFileSync(join(dir, BRIDGE_INFO_FILE), 'utf8')))

describe('bridge module', () => {
  it('activate provides the server whose url/token are in bridge.json', async () => {
    const provided = new Map<string, unknown>()
    const userData = tempDir()
    const ctx = {
      paths: { userData },
      log: memoryLogger(),
      services: { provide: (token: { id: string }, impl: unknown) => void provided.set(token.id, impl) },
    } as unknown as MainContext
    await mainModule.activate(ctx)
    const server = provided.get(BridgeServerToken.id) as BridgeServer
    expect(readInfo(userData)).toMatchObject({ url: server.url, token: server.token, pid: process.pid })
  })

  it('in the real host: serves /hook, and dispose removes bridge.json and frees the port', async () => {
    t = await createTestModuleHost({
      modules: [await loadModuleRecord(join(import.meta.dirname, '..'))],
      userDataDir: tempDir(),
    })
    const { url, token } = readInfo(t.userDataDir)
    const res = await postRaw(url, JSON.stringify({ type: 'x.y', payload: null }), bearer(token))
    expect(res.body).toMatchObject({ type: 'bridge.error', error: { code: 'unknown_type' } })
    const file = join(t.userDataDir, BRIDGE_INFO_FILE)
    await t.dispose()
    t = undefined
    expect(existsSync(file)).toBe(false)
    await expect(postRaw(url, '{}')).rejects.toMatchObject({ code: 'ECONNREFUSED' })
  })
})
