import type { z } from '@pragma/sdk'
import {
  BRIDGE_CLIENT_STATE,
  BRIDGE_CORE_REQUESTS,
  BRIDGE_ERROR,
  BRIDGE_ERROR_CODES,
  BRIDGE_RESERVED_NAMESPACE,
  BRIDGE_RESULT_TYPES,
  BRIDGE_UNAVAILABLE,
  BRIDGE_WS_CLOSE,
  type BridgeClientState,
  type BridgeErrorCodeName,
  CLIENT_RECONNECT_MAX_MS,
  CLIENT_RECONNECT_MIN_MS,
  CLIENT_REQUEST_TIMEOUT_MS,
  joinBridgeType,
  splitBridgeType,
} from '../contract/constants'
import { wsUrlFor } from '../contract/info'
import type { BridgeNamespaceDef } from '../contract/namespace'
import { BridgeRequestError, BridgeUnavailableError } from './errors'
import type { BridgeConnection } from './http'

/** The subset of the browser / `ws` WebSocket API the client uses. */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number }) => void) | null
  onerror: ((ev: unknown) => void) | null
}
export type WebSocketCtor = new (url: string, opts?: { headers?: Record<string, string> }) => WebSocketLike

export interface BridgeClientOptions {
  connection: BridgeConnection
  client: { kind: string; name?: string; version?: string }
  subscribe?: string[]
  /** Defaults to the global `WebSocket`; inject `ws` in Node < 22 or to send the Authorization header. */
  WebSocket?: WebSocketCtor
  requestTimeoutMs?: number
  reconnect?: { enabled: boolean; minDelayMs?: number; maxDelayMs?: number }
}

export interface BridgeClient {
  readonly state: BridgeClientState
  ready(): Promise<{ clientId: string }>
  request<D extends BridgeNamespaceDef, K extends keyof D['requests'] & string>(
    ns: D,
    name: K,
    payload: z.input<D['requests'][K]['input']>,
  ): Promise<z.infer<D['requests'][K]['output']>>
  requestRaw(type: string, payload: unknown): Promise<unknown>
  notify(type: string, payload: unknown): void
  on<D extends BridgeNamespaceDef, K extends keyof D['events'] & string>(
    ns: D,
    name: K,
    cb: (payload: z.infer<D['events'][K]>) => void,
  ): () => void
  onRaw(type: string, cb: (payload: unknown) => void): () => void
  onStateChange(cb: (state: BridgeClientState) => void): () => void
  close(): void
}

interface Pending {
  resolve(v: unknown): void
  reject(e: Error): void
  timer: ReturnType<typeof setTimeout>
}
interface Incoming {
  type?: unknown
  id?: unknown
  payload?: unknown
  error?: { code?: unknown; message?: unknown }
}

const HELLO = joinBridgeType(BRIDGE_RESERVED_NAMESPACE, BRIDGE_CORE_REQUESTS.hello)
const SUBSCRIBE = joinBridgeType(BRIDGE_RESERVED_NAMESPACE, BRIDGE_CORE_REQUESTS.subscribe)
const WS_OPEN = 1
const HELLO_ID = 'hello'
const BACKOFF_FACTOR = 2
const S = BRIDGE_CLIENT_STATE

const toError = (m: Incoming): BridgeRequestError => {
  const code = (BRIDGE_ERROR_CODES as readonly unknown[]).includes(m.error?.code)
    ? (m.error?.code as BridgeErrorCodeName)
    : BRIDGE_ERROR.bad_request
  return new BridgeRequestError(code, typeof m.error?.message === 'string' ? m.error.message : code)
}

class Client implements BridgeClient {
  state: BridgeClientState = S.connecting
  readonly #opts: BridgeClientOptions
  readonly #ctor: WebSocketCtor
  readonly #pending = new Map<string, Pending>()
  readonly #listeners = new Map<string, Set<(p: unknown) => void>>()
  readonly #stateListeners = new Set<(s: BridgeClientState) => void>()
  readonly #namespaces: Set<string>
  readonly #outbox: string[] = []
  #ws: WebSocketLike | undefined
  #seq = 0
  #attempt = 0
  #clientId: string | undefined
  #readyWaiters: { resolve(v: { clientId: string }): void; reject(e: Error): void }[] = []
  #userClosed = false

  constructor(opts: BridgeClientOptions) {
    this.#opts = opts
    this.#ctor = opts.WebSocket ?? (globalThis as unknown as { WebSocket: WebSocketCtor }).WebSocket
    this.#namespaces = new Set(opts.subscribe ?? [])
    this.#connect()
  }

  ready(): Promise<{ clientId: string }> {
    if (this.state === S.open && this.#clientId) return Promise.resolve({ clientId: this.#clientId })
    if (this.state === S.closed) return Promise.reject(new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable))
    return new Promise((resolve, reject) => this.#readyWaiters.push({ resolve, reject }))
  }

  /** Typed entry points delegate to untyped helpers (the generic signatures live once, on `BridgeClient`). */
  readonly request: BridgeClient['request'] = (ns, name, payload) => this.#request(ns, name, payload) as never
  readonly on: BridgeClient['on'] = (ns, name, cb) => this.#on(ns, name, cb as (p: unknown) => void)

  async #request(ns: BridgeNamespaceDef, name: string, payload: unknown): Promise<unknown> {
    const def = ns.requests[name]
    const raw = await this.requestRaw(joinBridgeType(ns.name, name), def ? def.input.parse(payload) : payload)
    return def ? def.output.parse(raw) : raw
  }

  requestRaw(type: string, payload: unknown): Promise<unknown> {
    if (this.state === S.closed) return Promise.reject(new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable))
    const id = String(++this.#seq)
    const timeoutMs = this.#opts.requestTimeoutMs ?? CLIENT_REQUEST_TIMEOUT_MS
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new BridgeRequestError(BRIDGE_ERROR.timeout, `${type} timed out after ${timeoutMs} ms`))
      }, timeoutMs)
      this.#pending.set(id, { resolve, reject, timer })
      this.#send({ type, id, payload }, true)
    })
  }

  notify(type: string, payload: unknown): void {
    this.#send({ type, payload }, true)
  }

  #on(ns: BridgeNamespaceDef, name: string, cb: (payload: unknown) => void): () => void {
    const schema = ns.events[name]
    return this.onRaw(joinBridgeType(ns.name, name), (p) => {
      const parsed = schema ? schema.safeParse(p) : { success: true as const, data: p }
      if (parsed.success) cb(parsed.data)
    })
  }

  onRaw(type: string, cb: (payload: unknown) => void): () => void {
    const set = this.#listeners.get(type) ?? new Set()
    set.add(cb)
    this.#listeners.set(type, set)
    this.#ensureSubscribed(splitBridgeType(type).namespace)
    return () => void set.delete(cb)
  }

  onStateChange(cb: (state: BridgeClientState) => void): () => void {
    this.#stateListeners.add(cb)
    return () => void this.#stateListeners.delete(cb)
  }

  close(): void {
    this.#userClosed = true
    this.#ws?.close()
    this.#finish(new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable, 'client closed'))
  }

  #setState(s: BridgeClientState): void {
    if (this.state === s) return
    this.state = s
    for (const cb of this.#stateListeners) cb(s)
  }

  #ensureSubscribed(namespace: string): void {
    if (this.#namespaces.has(namespace)) return
    this.#namespaces.add(namespace)
    if (this.state === S.open) this.#send({ type: SUBSCRIBE, payload: { namespaces: [namespace] } }, false)
  }

  #send(msg: unknown, queue: boolean): void {
    const text = JSON.stringify(msg)
    if (this.state === S.open && this.#ws?.readyState === WS_OPEN) this.#ws.send(text)
    else if (queue) this.#outbox.push(text)
  }

  #connect(): void {
    const { url, token } = this.#opts.connection
    const headers = this.#opts.WebSocket ? { headers: { authorization: `Bearer ${token}` } } : undefined
    const ws = new this.#ctor(wsUrlFor(url), headers)
    this.#ws = ws
    ws.onopen = () => {
      const payload = { token, client: this.#opts.client, subscribe: [...this.#namespaces] }
      ws.send(JSON.stringify({ type: HELLO, id: HELLO_ID, payload }))
    }
    ws.onmessage = (ev) => this.#onMessage(ev.data)
    ws.onclose = (ev) => this.#onClose(ev.code)
    ws.onerror = () => undefined
  }

  #onMessage(data: unknown): void {
    let m: Incoming
    try {
      m = JSON.parse(String(data)) as Incoming
    } catch {
      return
    }
    if (m.id === HELLO_ID) {
      this.#onHello(m)
      return
    }
    const pending = typeof m.id === 'string' ? this.#pending.get(m.id) : undefined
    if (pending && typeof m.id === 'string') {
      this.#pending.delete(m.id)
      clearTimeout(pending.timer)
      if (m.type === BRIDGE_RESULT_TYPES.result) pending.resolve(m.payload)
      else pending.reject(toError(m))
      return
    }
    if (typeof m.type === 'string') for (const cb of this.#listeners.get(m.type) ?? []) cb(m.payload)
  }

  #onHello(m: Incoming): void {
    if (m.type !== BRIDGE_RESULT_TYPES.result) return
    this.#clientId = (m.payload as { clientId: string }).clientId
    this.#attempt = 0
    this.#setState(S.open)
    for (const text of this.#outbox.splice(0)) this.#ws?.send(text)
    for (const w of this.#readyWaiters.splice(0)) w.resolve({ clientId: this.#clientId })
  }

  #onClose(code: number): void {
    this.#ws = undefined
    this.#clientId = undefined
    const rejected = code === BRIDGE_WS_CLOSE.unauthorized
    if (this.#userClosed || rejected || !this.#opts.reconnect?.enabled) {
      const reason = rejected ? BRIDGE_UNAVAILABLE.unauthorized : BRIDGE_UNAVAILABLE.unreachable
      this.#finish(new BridgeUnavailableError(reason))
      return
    }
    this.#setState(S.connecting)
    const { minDelayMs = CLIENT_RECONNECT_MIN_MS, maxDelayMs = CLIENT_RECONNECT_MAX_MS } = this.#opts.reconnect
    const delay = Math.min(maxDelayMs, minDelayMs * BACKOFF_FACTOR ** this.#attempt++)
    setTimeout(() => {
      if (!this.#userClosed) this.#connect()
    }, delay)
  }

  #finish(error: Error): void {
    this.#setState(S.closed)
    this.#outbox.length = 0
    for (const w of this.#readyWaiters.splice(0)) w.reject(error)
    for (const [id, p] of this.#pending) {
      clearTimeout(p.timer)
      this.#pending.delete(id)
      p.reject(error)
    }
  }
}

/** A WebSocket bridge client: hello first, string ids, per-request timeout, optional reconnect. */
export function createBridgeClient(opts: BridgeClientOptions): BridgeClient {
  return new Client(opts)
}
