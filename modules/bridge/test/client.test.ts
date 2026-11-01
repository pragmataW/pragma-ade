import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_NAME } from '@pragma/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import {
  type BridgeClient,
  BridgeRequestError,
  BridgeUnavailableError,
  createBridgeClient,
  postBridgeMessage,
  readBridgeInfo,
  type WebSocketCtor,
} from '../src/client'
import { BRIDGE_INFO_FILE } from '../src/contract'
import { startTestBridgeServer, type TestBridgeServer } from '../testing'
import { demoHandlers, demoNs } from './support/namespaces'
import { useTempDirs } from './support/tmp'

const tempDir = useTempDirs()
const servers: TestBridgeServer[] = []
const clients: BridgeClient[] = []
afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  for (const s of servers.splice(0)) await s.close()
})
const startServer = async (opts?: Parameters<typeof startTestBridgeServer>[0]) => {
  const s = await startTestBridgeServer(opts)
  s.registerHandler(demoNs, demoHandlers)
  servers.push(s)
  return s
}
const client = (s: TestBridgeServer, over: Partial<Parameters<typeof createBridgeClient>[0]> = {}) => {
  const c = createBridgeClient({
    connection: s.connection,
    client: { kind: 'test' },
    WebSocket: WebSocket as unknown as WebSocketCtor,
    ...over,
  })
  clients.push(c)
  return c
}

const infoJson = (url: string, token = 't'.repeat(43)) =>
  JSON.stringify({ version: 1, url, wsUrl: `${url}/ws`, token, pid: 1, startedAt: 'x' })
const writeInfo = (dir: string, url: string) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, BRIDGE_INFO_FILE), infoJson(url))
  return dir
}

describe('readBridgeInfo', () => {
  it.each<[string, (d: string) => { env: Record<string, string>; dirs?: string[] }, string | null]>([
    [
      'env pair wins over everything',
      (d) => ({
        env: {
          PRAGMA_BRIDGE_URL: 'http://e:1',
          PRAGMA_BRIDGE_TOKEN: 'tok',
          PRAGMA_BRIDGE_FILE: join(writeInfo(join(d, 'f'), 'http://f:1'), BRIDGE_INFO_FILE),
        },
      }),
      'http://e:1',
    ],
    [
      'URL without TOKEN ignored',
      (d) => ({ env: { PRAGMA_BRIDGE_URL: 'http://e:1' }, dirs: [writeInfo(join(d, 'u'), 'http://u:1')] }),
      'http://u:1',
    ],
    [
      'PRAGMA_BRIDGE_FILE before PRAGMA_USER_DATA',
      (d) => ({
        env: {
          PRAGMA_BRIDGE_FILE: join(writeInfo(join(d, 'f'), 'http://f:1'), BRIDGE_INFO_FILE),
          PRAGMA_USER_DATA: writeInfo(join(d, 'u'), 'http://u:1'),
        },
      }),
      'http://f:1',
    ],
    [
      'PRAGMA_USER_DATA before userDataDirs',
      (d) => ({
        env: { PRAGMA_USER_DATA: writeInfo(join(d, 'u'), 'http://u:1') },
        dirs: [writeInfo(join(d, 'x'), 'http://x:1')],
      }),
      'http://u:1',
    ],
    [
      'first existing userDataDir wins',
      (d) => ({
        env: {},
        dirs: [join(d, 'missing'), writeInfo(join(d, 'a'), 'http://a:1'), writeInfo(join(d, 'b'), 'http://b:1')],
      }),
      'http://a:1',
    ],
    ['nothing → no_config', (d) => ({ env: {}, dirs: [join(d, 'missing')] }), null],
  ])('%s', async (_name, setup, url) => {
    const { env, dirs } = setup(tempDir())
    const read = readBridgeInfo({ env, userDataDirs: dirs, home: tempDir(), platform: 'linux' })
    if (url) expect((await read).url).toBe(url)
    else await expect(read).rejects.toMatchObject({ reason: 'no_config' })
  })

  it('defaults to the SDK defaultUserDataDirs (darwin)', async () => {
    const home = tempDir()
    writeInfo(join(home, 'Library', 'Application Support', APP_NAME), 'http://d:1')
    const info = await readBridgeInfo({ env: {}, home, platform: 'darwin' })
    expect(info).toMatchObject({ url: 'http://d:1', source: 'file' })
  })

  it('invalid file → no_config with path', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, BRIDGE_INFO_FILE), '{"version":1}')
    await expect(readBridgeInfo({ env: {}, userDataDirs: [dir] })).rejects.toThrow(join(dir, BRIDGE_INFO_FILE))
  })
})

describe('postBridgeMessage', () => {
  it('returns the payload', async () => {
    const s = await startServer()
    expect(await postBridgeMessage(s.connection, { type: 'demo.echo', payload: { text: 'a' } })).toEqual({ text: 'a' })
  })

  it('bridge.error → BridgeRequestError(code)', async () => {
    const s = await startServer()
    const p = postBridgeMessage(s.connection, { type: 'demo.echo', payload: {} })
    await expect(p).rejects.toBeInstanceOf(BridgeRequestError)
    await expect(p).rejects.toMatchObject({ code: 'invalid_payload' })
  })

  it('wrong token → unauthorized', async () => {
    const s = await startServer()
    await expect(
      postBridgeMessage({ url: s.url, token: 'nope' }, { type: 'demo.echo', payload: { text: 'a' } }),
    ).rejects.toMatchObject({ reason: 'unauthorized' })
  })

  it('stale info file → unreachable', async () => {
    const s = await startServer()
    const infoFile = join(s.infoDir, BRIDGE_INFO_FILE)
    const stale = JSON.parse(readFileSync(infoFile, 'utf8'))
    const dir = tempDir()
    writeFileSync(join(dir, BRIDGE_INFO_FILE), JSON.stringify(stale))
    await s.close()
    servers.length = 0
    const info = await readBridgeInfo({ env: {}, userDataDirs: [dir] })
    const started = Date.now()
    const p = postBridgeMessage(info, { type: 'demo.echo', payload: { text: 'a' } })
    await expect(p).rejects.toBeInstanceOf(BridgeUnavailableError)
    await expect(p).rejects.toMatchObject({ reason: 'unreachable' })
    expect(Date.now() - started).toBeLessThan(3500)
  })

  it('http.ts has no zod import', () => {
    const source = readFileSync(join(import.meta.dirname, '../src/client/http.ts'), 'utf8')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports).toEqual(['../contract/constants', './errors'])
    const errors = readFileSync(join(import.meta.dirname, '../src/client/errors.ts'), 'utf8')
    expect([...errors.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['../contract/constants'])
    const constants = readFileSync(join(import.meta.dirname, '../src/contract/constants.ts'), 'utf8')
    expect(constants).not.toMatch(/^import /m)
  })
})

describe('createBridgeClient', () => {
  it('ready → clientId', async () => {
    const s = await startServer()
    expect((await client(s).ready()).clientId).toMatch(/^ws:/)
  })

  it('typed request round-trip', async () => {
    const s = await startServer()
    expect(await client(s).request(demoNs, 'echo', { text: 'yo' })).toEqual({ text: 'yo' })
  })

  it('bridge.error rejects with BridgeRequestError', async () => {
    const s = await startServer()
    await expect(client(s).requestRaw('demo.fail', null)).rejects.toMatchObject({ code: 'handler_error' })
  })

  it('timeout → BridgeRequestError(timeout)', async () => {
    const s = await startServer()
    s.registerHandler('slow', { wait: () => new Promise(() => undefined) })
    await expect(client(s, { requestTimeoutMs: 100 }).requestRaw('slow.wait', null)).rejects.toMatchObject({
      code: 'timeout',
    })
  })

  it('on() receives broadcast', async () => {
    const s = await startServer()
    const c = client(s)
    const seen = vi.fn()
    c.on(demoNs, 'tick', seen)
    await c.ready()
    await vi.waitFor(() => expect(s.broadcast(demoNs, { name: 'tick', payload: { n: 2 } })).toBe(1))
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith({ n: 2 }))
  })

  it('reconnects after a server restart on the same port and re-subscribes', async () => {
    const s = await startServer()
    const c = client(s, { subscribe: ['demo'], reconnect: { enabled: true, minDelayMs: 20, maxDelayMs: 50 } })
    const seen = vi.fn()
    c.on(demoNs, 'tick', seen)
    await c.ready()
    const { port, token } = s
    await s.close()
    servers.length = 0
    await vi.waitFor(() => expect(c.state).toBe('connecting'))
    const s2 = await startServer({ port, token })
    await vi.waitFor(() => expect(c.state).toBe('open'), { timeout: 3000 })
    await vi.waitFor(() => expect(s2.broadcast(demoNs, { name: 'tick', payload: { n: 3 } })).toBe(1))
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith({ n: 3 }))
  })

  it('4401 → closed, no reconnect', async () => {
    const s = await startServer()
    const c = client(s, {
      connection: { url: s.url, token: 'wrong' },
      WebSocket: class extends WebSocket {
        constructor(url: string) {
          super(url)
        }
      } as unknown as WebSocketCtor,
      reconnect: { enabled: true, minDelayMs: 10 },
    })
    await expect(c.ready()).rejects.toMatchObject({ reason: 'unauthorized' })
    expect(c.state).toBe('closed')
  })
})
