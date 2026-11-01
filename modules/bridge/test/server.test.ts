import { describe, expect, it, vi } from 'vitest'
import { demoHandlers, demoNs } from './support/namespaces'
import { bearer, connectRaw, hello, postRaw, useBridgeServers } from './support/servers'

const start = useBridgeServers()
const startDemo = async (opts?: Parameters<typeof start>[0]) => {
  const s = await start(opts)
  s.registerHandler(demoNs, demoHandlers)
  return s
}
const echo = (id?: string) => JSON.stringify({ type: 'demo.echo', id, payload: { text: 'hi' } })

describe('bridge http', () => {
  it.each<
    [
      string,
      (t: string, port: number) => [string | Buffer, Record<string, string>, { method?: string; path?: string }?],
      number,
      string?,
    ]
  >([
    ['no token', () => [echo(), {}], 401, 'unauthorized'],
    ['wrong token', () => [echo(), bearer('nope')], 401, 'unauthorized'],
    ['valid', (t) => [echo('1'), bearer(t)], 200],
    ['non-JSON', (t) => ['{', bearer(t)], 400, 'bad_request'],
    ['bad envelope', (t) => [JSON.stringify({ type: 'nope' }), bearer(t)], 400, 'bad_request'],
    ['oversize', (t) => [Buffer.alloc(1_048_577, 32), bearer(t)], 413, 'payload_too_large'],
    ['GET /', (t) => ['', bearer(t), { method: 'GET', path: '/' }], 404],
    ['GET /hook', (t) => ['', bearer(t), { method: 'GET' }], 405],
    ['Host evil.com', (t, port) => [echo(), { ...bearer(t), host: `evil.com:${port}` }], 421],
    ['Origin evil', (t) => [echo(), { ...bearer(t), origin: 'https://evil.com' }], 403],
  ])('%s → %i', async (_name, make, status, code) => {
    const s = await startDemo()
    const [body, headers, opts] = make(s.token, s.port)
    const res = await postRaw(s.url, body, headers, opts)
    expect(res.status).toBe(status)
    if (code) expect(res.body).toMatchObject({ type: 'bridge.error', error: { code } })
  })

  it('valid request returns the handler result', async () => {
    const s = await startDemo()
    const res = await postRaw(s.url, echo('1'), bearer(s.token))
    expect(res.body).toEqual({ type: 'bridge.result', id: '1', payload: { text: 'hi' } })
  })
})

describe('bridge websocket', () => {
  it('no hello within 200 ms closes 4401', async () => {
    const s = await startDemo({ helloTimeoutMs: 200 })
    const sock = await connectRaw(s.wsUrl)
    expect(await sock.closed).toBe(4401)
  })

  it.each([
    ['wrong token', hello('wrong')],
    ['message before hello', { type: 'demo.echo', id: '1', payload: { text: 'x' } }],
  ])('%s closes 4401', async (_n, first) => {
    const s = await startDemo()
    const sock = await connectRaw(s.wsUrl)
    sock.send(first)
    expect(await sock.next()).toMatchObject({ type: 'bridge.error', error: { code: 'unauthorized' } })
    expect(await sock.closed).toBe(4401)
  })

  it('header auth + hello without token accepted', async () => {
    const s = await startDemo()
    const sock = await connectRaw(s.wsUrl, bearer(s.token))
    sock.send(hello(''))
    expect(await sock.next()).toMatchObject({ type: 'bridge.result', id: 'h', payload: { protocolVersion: 1 } })
  })

  it('request/response echoes id', async () => {
    const s = await startDemo()
    const sock = await connectRaw(s.wsUrl)
    sock.send(hello(s.token))
    await sock.next()
    sock.send({ type: 'demo.echo', id: 'r9', payload: { text: 'yo' } })
    expect(await sock.next()).toEqual({ type: 'bridge.result', id: 'r9', payload: { text: 'yo' } })
    sock.send({ type: 'bridge.ping', id: 'p' })
    expect(await sock.next()).toMatchObject({ id: 'p', payload: { now: expect.any(Number) } })
  })

  it('fire-and-forget reaches handler', async () => {
    const s = await start()
    const seen = vi.fn()
    s.registerHandler('ff', { note: (p) => seen(p) })
    const sock = await connectRaw(s.wsUrl)
    sock.send(hello(s.token))
    await sock.next()
    sock.send({ type: 'ff.note', payload: 7 })
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(7))
  })

  it('broadcast reaches only subscribers and returns 1', async () => {
    const s = await startDemo()
    const sub = await connectRaw(s.wsUrl)
    sub.send(hello(s.token, ['demo']))
    await sub.next()
    const other = await connectRaw(s.wsUrl)
    other.send(hello(s.token))
    await other.next()
    expect(s.broadcast(demoNs, { name: 'tick', payload: { n: 1 } })).toBe(1)
    expect(await sub.next()).toEqual({ type: 'demo.tick', payload: { n: 1 } })
    expect(other.messages).toEqual([])
  })

  it('subscribe adds namespaces later', async () => {
    const s = await startDemo()
    const sock = await connectRaw(s.wsUrl)
    sock.send(hello(s.token))
    await sock.next()
    sock.send({ type: 'bridge.subscribe', id: 's', payload: { namespaces: ['demo'] } })
    expect(await sock.next()).toMatchObject({ payload: { namespaces: ['demo'] } })
    expect(s.listClients({ namespace: 'demo' })).toHaveLength(1)
  })

  it('broadcast validates against def', async () => {
    const s = await startDemo()
    expect(() => s.broadcast(demoNs, { name: 'tick', payload: { n: 'x' } as unknown as { n: number } })).toThrow()
  })

  it('send to unknown → false', async () => {
    const s = await startDemo()
    expect(s.send('ws:nope', { type: 'a.b', payload: null })).toBe(false)
  })

  it('onClient fires', async () => {
    const s = await startDemo()
    const connected = vi.fn()
    const disconnected = vi.fn()
    s.onClient('connected', connected)
    s.onClient('disconnected', disconnected)
    const sock = await connectRaw(s.wsUrl)
    sock.send(hello(s.token))
    await sock.next()
    expect(connected).toHaveBeenCalledWith(expect.objectContaining({ kind: 'test', transport: 'ws' }))
    expect(s.send(s.listClients()[0]?.clientId ?? '', { type: 'a.b', payload: 1 })).toBe(true)
    sock.ws.close()
    await vi.waitFor(() => expect(disconnected).toHaveBeenCalledTimes(1))
  })

  it('close() stops serving', async () => {
    const s = await startDemo()
    const sock = await connectRaw(s.wsUrl)
    sock.send(hello(s.token))
    await sock.next()
    await s.close()
    await sock.closed
    await expect(postRaw(s.url, echo(), bearer(s.token))).rejects.toMatchObject({ code: 'ECONNREFUSED' })
  })
})
