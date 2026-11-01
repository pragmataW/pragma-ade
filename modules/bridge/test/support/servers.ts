import { request } from 'node:http'
import { afterEach } from 'vitest'
import { WebSocket } from 'ws'
import { BRIDGE_PATHS } from '../../src/contract'
import { type CreateBridgeServerOptions, createBridgeServer, type RunningBridgeServer } from '../../src/main/server'

/** Starts bridge servers that are closed after the current test. */
export function useBridgeServers(): (opts?: CreateBridgeServerOptions) => Promise<RunningBridgeServer> {
  const running: RunningBridgeServer[] = []
  afterEach(async () => {
    for (const s of running.splice(0)) await s.close()
  })
  return async (opts) => {
    const s = await createBridgeServer(opts)
    running.push(s)
    return s
  }
}

export interface RawResponse {
  status: number
  body: unknown
}

/**
 * A raw HTTP request (full control over Host/Origin headers). Settles once the response ended AND the body was fully
 * written: the server may answer early (413) while still draining the upload, and closing it then would break the pipe.
 */
export function postRaw(
  url: string,
  body: string | Buffer,
  headers: Record<string, string> = {},
  opts: { method?: string; path?: string } = {},
): Promise<RawResponse> {
  const target = new URL(opts.path ?? BRIDGE_PATHS.hook, url)
  let sent!: () => void
  const written = new Promise<void>((r) => {
    sent = r
  })
  const response = new Promise<RawResponse>((resolve, reject) => {
    const req = request(target, { method: opts.method ?? 'POST', headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        let parsed: unknown = text
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {}
        resolve({ status: res.statusCode ?? 0, body: parsed })
      })
    })
    req.on('error', reject)
    req.end(body, sent)
  })
  return response.then(async (r) => {
    await written
    return r
  })
}

export const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })

export interface RawSocket {
  ws: WebSocket
  messages: unknown[]
  next(): Promise<unknown>
  closed: Promise<number>
  send(msg: unknown): void
}

/** A raw `ws` client that queues parsed messages. */
export async function connectRaw(wsUrl: string, headers: Record<string, string> = {}): Promise<RawSocket> {
  const ws = new WebSocket(wsUrl, { headers })
  const messages: unknown[] = []
  const waiters: ((m: unknown) => void)[] = []
  ws.on('message', (d) => {
    const m = JSON.parse(String(d))
    const w = waiters.shift()
    if (w) w(m)
    else messages.push(m)
  })
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)))
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  return {
    ws,
    messages,
    next: () => (messages.length > 0 ? Promise.resolve(messages.shift()) : new Promise((r) => waiters.push(r))),
    closed,
    send: (msg) => ws.send(JSON.stringify(msg)),
  }
}

export const hello = (token: string, subscribe: string[] = [], id = 'h') => ({
  type: 'bridge.hello',
  id,
  payload: { token, client: { kind: 'test' }, subscribe },
})
