import type { Logger, z } from '@pragma/sdk'
import {
  BRIDGE_ERROR,
  BRIDGE_RESERVED_NAMESPACE,
  BRIDGE_RESULT_TYPES,
  type BridgeEnvelope,
  type BridgeErrorCode,
  type BridgeHandlers,
  type BridgeNamespaceDef,
  type BridgeRequestContext,
  type BridgeResult,
  type RawBridgeHandler,
  splitBridgeType,
} from '../contract'

const INVALID_OUTPUT = 'invalid handler output'

export const resultOk = (id: string | undefined, payload: unknown): BridgeResult => ({
  type: BRIDGE_RESULT_TYPES.result,
  ...(id === undefined ? {} : { id }),
  payload,
})

export const resultError = (id: string | undefined, code: BridgeErrorCode, message: string): BridgeResult => ({
  type: BRIDGE_RESULT_TYPES.error,
  ...(id === undefined ? {} : { id }),
  error: { code, message },
})

interface Entry {
  def?: BridgeNamespaceDef
  handlers: Record<string, RawBridgeHandler>
}

/** Typed handlers are not assignable to raw ones (parameter variance); the registry validates inputs itself. */
type AnyHandlers = BridgeHandlers<BridgeNamespaceDef> | Record<string, RawBridgeHandler>

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Namespace → handlers; validates typed namespaces on the way in and out. */
export class HandlerRegistry {
  readonly #entries = new Map<string, Entry>()
  readonly #log?: Pick<Logger, 'warn'>

  constructor(log?: Pick<Logger, 'warn'>) {
    this.#log = log
  }

  register<D extends BridgeNamespaceDef>(namespace: D, handlers: BridgeHandlers<D>): () => void
  register(namespace: string, handlers: Record<string, RawBridgeHandler>): () => void
  register(namespace: BridgeNamespaceDef | string, handlers: AnyHandlers): () => void {
    const def = typeof namespace === 'string' ? undefined : namespace
    const name = def?.name ?? (namespace as string)
    if (name === BRIDGE_RESERVED_NAMESPACE) throw new Error(`bridge namespace "${name}" is reserved`)
    if (this.#entries.has(name)) throw new Error(`bridge namespace "${name}" is already registered`)
    const entry: Entry = { def, handlers: handlers as Record<string, RawBridgeHandler> }
    this.#entries.set(name, entry)
    return () => {
      if (this.#entries.get(name) === entry) this.#entries.delete(name)
    }
  }

  has(namespace: string): boolean {
    return this.#entries.has(namespace)
  }

  eventSchema(namespace: string, name: string): z.ZodTypeAny | undefined {
    const events = this.#entries.get(namespace)?.def?.events
    return events && Object.hasOwn(events, name) ? events[name] : undefined
  }

  async dispatch(envelope: BridgeEnvelope, ctx: BridgeRequestContext): Promise<BridgeResult> {
    const { id, type } = envelope
    const { namespace, name } = splitBridgeType(type)
    const entry = this.#entries.get(namespace)
    const handler = entry && Object.hasOwn(entry.handlers, name) ? entry.handlers[name] : undefined
    if (!entry || !handler) return resultError(id, BRIDGE_ERROR.unknown_type, `unknown type "${type}"`)
    const def = entry.def?.requests[name]
    const input = def ? def.input.safeParse(envelope.payload) : { success: true as const, data: envelope.payload }
    if (!input.success) return resultError(id, BRIDGE_ERROR.invalid_payload, input.error.message)
    let output: unknown
    try {
      output = await handler(input.data, ctx)
    } catch (e) {
      return resultError(id, BRIDGE_ERROR.handler_error, errorMessage(e))
    }
    if (!def) return resultOk(id, output)
    const parsed = def.output.safeParse(output)
    if (parsed.success) return resultOk(id, parsed.data)
    this.#log?.warn(`${INVALID_OUTPUT} for ${type}`, parsed.error.message)
    return resultError(id, BRIDGE_ERROR.handler_error, INVALID_OUTPUT)
  }
}
