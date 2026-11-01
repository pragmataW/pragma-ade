import { createServiceToken, z } from '@pragma/sdk'
import { BRIDGE_TRANSPORTS } from './constants'
import type { BridgeEventPayload, BridgeHandlers, BridgeNamespaceDef, RawBridgeHandler } from './namespace'

const BRIDGE_SERVICE_ID = 'bridge.server'

export const BridgeClientInfoSchema = z.object({
  clientId: z.string(),
  kind: z.string(),
  name: z.string().optional(),
  version: z.string().optional(),
  transport: z.enum(BRIDGE_TRANSPORTS),
  namespaces: z.array(z.string()),
  connectedAt: z.number(),
})
export type BridgeClientInfo = z.infer<typeof BridgeClientInfoSchema>

export interface BridgeRequestContext {
  clientId: string
  transport: BridgeClientInfo['transport']
  client?: BridgeClientInfo
}

export type BridgeClientEvent = 'connected' | 'disconnected'

/** `BridgeServerToken` (§7): the running server other modules register namespaces on. */
export interface BridgeServer {
  readonly url: string
  readonly wsUrl: string
  readonly token: string
  /** Returns a disposer that unregisters the namespace. */
  registerHandler<D extends BridgeNamespaceDef>(namespace: D, handlers: BridgeHandlers<D>): () => void
  registerHandler(namespace: string, handlers: Record<string, RawBridgeHandler>): () => void
  /** Sends `{ type: '<ns>.<name>', payload }` to the namespace's subscribers; returns how many got it. */
  broadcast<D extends BridgeNamespaceDef, K extends keyof D['events'] & string>(
    namespace: D,
    msg: { name: K; payload: BridgeEventPayload<D, K> },
  ): number
  broadcast(namespace: string, msg: { name: string; payload: unknown }): number
  send(clientId: string, msg: { type: string; payload: unknown }): boolean
  listClients(filter?: { kind?: string; namespace?: string }): BridgeClientInfo[]
  onClient(event: BridgeClientEvent, cb: (client: BridgeClientInfo) => void): () => void
}

export const BridgeServerToken = createServiceToken<BridgeServer>(BRIDGE_SERVICE_ID)
