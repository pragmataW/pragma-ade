import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import type { Logger } from '@pragma/sdk'
import { WebSocketServer } from 'ws'
import {
  CLIENT_ID_PREFIX,
  HELLO_TIMEOUT_MS,
  HTTP_METHOD_POST,
  HTTP_STATUS,
  LOOPBACK_HOST,
  NODE_EVENTS,
} from '../constants'
import {
  BRIDGE_ERROR,
  BRIDGE_MAX_BODY_BYTES,
  BRIDGE_PATHS,
  BRIDGE_TRANSPORT,
  type BridgeClientEvent,
  type BridgeClientInfo,
  BridgeEnvelopeSchema,
  type BridgeNamespaceDef,
  type BridgeServer,
  joinBridgeType,
  wsUrlFor,
} from '../contract'
import { bearerFrom, generateToken, isAllowedHost, isAllowedOrigin, tokensEqual } from './auth'
import { BodyTooLargeError, parseJson, pathOf, readBody, sendJson, sendStatus } from './http-io'
import { HandlerRegistry, resultError } from './registry'
import { WsSession } from './ws-session'

export interface CreateBridgeServerOptions {
  token?: string
  /** Default 0 (a free port); tests restart on a fixed one. */
  port?: number
  log?: Pick<Logger, 'warn' | 'debug'>
  helloTimeoutMs?: number
}

export interface RunningBridgeServer extends BridgeServer {
  readonly port: number
  close(): Promise<void>
}

type Listener = (client: BridgeClientInfo) => void

const listen = (server: ReturnType<typeof createServer>, port: number): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once(NODE_EVENTS.error, reject)
    server.listen(port, LOOPBACK_HOST, () => {
      server.off(NODE_EVENTS.error, reject)
      resolve((server.address() as AddressInfo).port)
    })
  })

const rejectUpgrade = (socket: Duplex, status: number): void => {
  socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`)
}

/** HTTP (`POST /hook`) + WebSocket (`/ws`) bridge on 127.0.0.1 with bearer-token auth. */
export async function createBridgeServer(opts: CreateBridgeServerOptions = {}): Promise<RunningBridgeServer> {
  const token = opts.token ?? generateToken()
  const registry = new HandlerRegistry(opts.log)
  const sessions = new Map<string, WsSession>()
  const listeners: Record<BridgeClientEvent, Set<Listener>> = { connected: new Set(), disconnected: new Set() }
  const emit = (event: BridgeClientEvent, info: BridgeClientInfo): void => {
    for (const cb of listeners[event]) cb(info)
  }
  const checkToken = (given: string | null | undefined): boolean => tokensEqual(token, given)
  let port = 0
  const guardsFail = (req: IncomingMessage): number | null => {
    if (!isAllowedHost(req.headers.host, port)) return HTTP_STATUS.misdirected
    if (!isAllowedOrigin(req.headers.origin)) return HTTP_STATUS.forbidden
    return null
  }

  const routeFail = (req: IncomingMessage): number | null => {
    if (pathOf(req) !== BRIDGE_PATHS.hook) return HTTP_STATUS.notFound
    return req.method === HTTP_METHOD_POST ? null : HTTP_STATUS.methodNotAllowed
  }

  const handleHook = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!checkToken(bearerFrom(req.headers.authorization)))
      return sendJson(res, HTTP_STATUS.unauthorized, resultError(undefined, BRIDGE_ERROR.unauthorized, 'unauthorized'))
    let body: string
    try {
      body = await readBody(req)
    } catch (e) {
      if (!(e instanceof BodyTooLargeError)) throw e
      const err = resultError(undefined, BRIDGE_ERROR.payload_too_large, `body over ${BRIDGE_MAX_BODY_BYTES} bytes`)
      return sendJson(res, HTTP_STATUS.payloadTooLarge, err)
    }
    const envelope = BridgeEnvelopeSchema.safeParse(parseJson(body))
    if (!envelope.success)
      return sendJson(res, HTTP_STATUS.badRequest, resultError(undefined, BRIDGE_ERROR.bad_request, 'bad envelope'))
    const ctx = { clientId: `${CLIENT_ID_PREFIX.http}${randomUUID()}`, transport: BRIDGE_TRANSPORT.http }
    sendJson(res, HTTP_STATUS.ok, await registry.dispatch(envelope.data, ctx))
  }

  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const status = guardsFail(req) ?? routeFail(req)
    if (status !== null) {
      sendStatus(res, status)
      return
    }
    handleHook(req, res).catch((e) => {
      opts.log?.warn('bridge hook request failed', e)
      if (!res.headersSent) sendStatus(res, HTTP_STATUS.badRequest)
    })
  }

  const http = createServer(onRequest)
  const wss = new WebSocketServer({ noServer: true, maxPayload: BRIDGE_MAX_BODY_BYTES })
  const sessionDeps = {
    registry,
    checkToken,
    helloTimeoutMs: opts.helloTimeoutMs ?? HELLO_TIMEOUT_MS,
    log: opts.log,
    onHello: (s: WsSession) => {
      sessions.set(s.clientId, s)
      if (s.info) emit('connected', s.info)
    },
    onClose: (s: WsSession) => {
      if (sessions.delete(s.clientId) && s.info) emit('disconnected', s.info)
    },
  }
  http.on(NODE_EVENTS.upgrade, (req, socket, head) => {
    const status = guardsFail(req) ?? (pathOf(req) === BRIDGE_PATHS.ws ? null : HTTP_STATUS.notFound)
    if (status !== null) {
      rejectUpgrade(socket, status)
      return
    }
    const preAuthed = checkToken(bearerFrom(req.headers.authorization))
    wss.handleUpgrade(req, socket, head, (ws) => new WsSession(ws, preAuthed, sessionDeps))
  })

  port = await listen(http, opts.port ?? 0)
  const url = `http://${LOOPBACK_HOST}:${port}`

  const broadcast = (namespace: BridgeNamespaceDef | string, msg: { name: string; payload: unknown }): number => {
    const name = typeof namespace === 'string' ? namespace : namespace.name
    const schema = typeof namespace === 'string' ? undefined : namespace.events[msg.name]
    const payload = schema ? schema.parse(msg.payload) : msg.payload
    const type = joinBridgeType(name, msg.name)
    let count = 0
    for (const s of sessions.values()) if (s.subscribed(name) && s.send({ type, payload })) count++
    return count
  }

  const server: RunningBridgeServer = {
    url,
    wsUrl: wsUrlFor(url),
    token,
    port,
    registerHandler: ((namespace: BridgeNamespaceDef | string, handlers: never) =>
      registry.register(namespace as string, handlers)) as BridgeServer['registerHandler'],
    broadcast: broadcast as BridgeServer['broadcast'],
    send: (clientId, msg) => sessions.get(clientId)?.send(msg) ?? false,
    listClients: (filter = {}) =>
      [...sessions.values()]
        .flatMap((s) => (s.info ? [s.info] : []))
        .filter(
          (c) =>
            (!filter.kind || c.kind === filter.kind) && (!filter.namespace || c.namespaces.includes(filter.namespace)),
        ),
    onClient(event, cb) {
      listeners[event].add(cb)
      return () => void listeners[event].delete(cb)
    },
    async close() {
      for (const s of sessions.values()) s.terminate()
      for (const ws of wss.clients) ws.terminate()
      wss.close()
      http.closeAllConnections()
      await new Promise<void>((resolve) => http.close(() => resolve()))
    },
  }
  return server
}
