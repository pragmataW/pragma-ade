import { randomUUID } from 'node:crypto'
import type { Logger } from '@pragma/sdk'
import type { WebSocket } from 'ws'
import { CLIENT_ID_PREFIX, NODE_EVENTS } from '../constants'
import {
  BRIDGE_CORE_REQUESTS,
  BRIDGE_ERROR,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_RESERVED_NAMESPACE,
  BRIDGE_RESULT_TYPES,
  BRIDGE_TRANSPORT,
  BRIDGE_WS_CLOSE,
  type BridgeClientInfo,
  type BridgeEnvelope,
  BridgeEnvelopeSchema,
  type BridgeResult,
  bridgeCore,
  joinBridgeType,
  splitBridgeType,
} from '../contract'
import { parseJson } from './http-io'
import { type HandlerRegistry, resultError, resultOk } from './registry'

const HELLO_TYPE = joinBridgeType(BRIDGE_RESERVED_NAMESPACE, BRIDGE_CORE_REQUESTS.hello)
const UNAUTHORIZED_MESSAGE = 'unauthorized'

export interface WsSessionDeps {
  registry: HandlerRegistry
  checkToken(token: string): boolean
  helloTimeoutMs: number
  log?: Pick<Logger, 'warn' | 'debug'>
  onHello(session: WsSession): void
  onClose(session: WsSession): void
}

/** One authenticated (or authenticating) WebSocket client. */
export class WsSession {
  readonly clientId = `${CLIENT_ID_PREFIX.ws}${randomUUID()}`
  info: BridgeClientInfo | undefined
  readonly #ws: WebSocket
  readonly #deps: WsSessionDeps
  readonly #preAuthed: boolean
  readonly #helloTimer: ReturnType<typeof setTimeout>

  constructor(ws: WebSocket, preAuthed: boolean, deps: WsSessionDeps) {
    this.#ws = ws
    this.#deps = deps
    this.#preAuthed = preAuthed
    this.#helloTimer = setTimeout(() => this.#reject(), deps.helloTimeoutMs)
    ws.on(NODE_EVENTS.message, (data) => void this.#onMessage(String(data)))
    ws.on(NODE_EVENTS.close, () => {
      clearTimeout(this.#helloTimer)
      deps.onClose(this)
    })
    ws.on(NODE_EVENTS.error, (e) => deps.log?.debug('bridge ws error', e))
  }

  send(msg: unknown): boolean {
    if (this.#ws.readyState !== this.#ws.OPEN) return false
    this.#ws.send(JSON.stringify(msg))
    return true
  }

  terminate(): void {
    this.#ws.terminate()
  }

  subscribed(namespace: string): boolean {
    return this.info?.namespaces.includes(namespace) ?? false
  }

  #reject(): void {
    this.send(resultError(undefined, BRIDGE_ERROR.unauthorized, UNAUTHORIZED_MESSAGE))
    this.#ws.close(BRIDGE_WS_CLOSE.unauthorized, UNAUTHORIZED_MESSAGE)
  }

  async #onMessage(text: string): Promise<void> {
    const parsed = BridgeEnvelopeSchema.safeParse(parseJson(text))
    if (!this.info) return this.#hello(parsed.success ? parsed.data : undefined)
    if (!parsed.success) {
      this.send(resultError(undefined, BRIDGE_ERROR.bad_request, parsed.error.message))
      return
    }
    const result = await this.#handle(parsed.data)
    if (parsed.data.id !== undefined) this.send(result)
    else if (result.type !== BRIDGE_RESULT_TYPES.result) this.#deps.log?.debug('bridge fire-and-forget failed', result)
  }

  #hello(envelope: BridgeEnvelope | undefined): void {
    const input = envelope?.type === HELLO_TYPE ? bridgeCore.requests.hello.input.safeParse(envelope.payload) : null
    if (!input?.success || !(this.#preAuthed || this.#deps.checkToken(input.data.token))) {
      this.#reject()
      return
    }
    clearTimeout(this.#helloTimer)
    const { client, subscribe } = input.data
    this.info = {
      clientId: this.clientId,
      ...client,
      transport: BRIDGE_TRANSPORT.ws,
      namespaces: [...new Set(subscribe)],
      connectedAt: Date.now(),
    }
    if (envelope?.id !== undefined)
      this.send(resultOk(envelope.id, { clientId: this.clientId, protocolVersion: BRIDGE_PROTOCOL_VERSION }))
    this.#deps.onHello(this)
  }

  async #handle(envelope: BridgeEnvelope): Promise<BridgeResult> {
    const { namespace, name } = splitBridgeType(envelope.type)
    if (namespace !== BRIDGE_RESERVED_NAMESPACE)
      return this.#deps.registry.dispatch(envelope, {
        clientId: this.clientId,
        transport: BRIDGE_TRANSPORT.ws,
        client: this.info,
      })
    return this.#core(name, envelope)
  }

  #core(name: string, envelope: BridgeEnvelope): BridgeResult {
    const { id, payload } = envelope
    if (name === BRIDGE_CORE_REQUESTS.ping) return resultOk(id, { now: Date.now() })
    if (name !== BRIDGE_CORE_REQUESTS.subscribe)
      return resultError(id, BRIDGE_ERROR.unknown_type, `unknown type "${envelope.type}"`)
    const input = bridgeCore.requests.subscribe.input.safeParse(payload)
    if (!input.success || !this.info) return resultError(id, BRIDGE_ERROR.invalid_payload, 'invalid subscribe')
    this.info.namespaces = [...new Set([...this.info.namespaces, ...input.data.namespaces])]
    return resultOk(id, { namespaces: this.info.namespaces })
  }
}
