import { z } from '@pragma/sdk'
import {
  BRIDGE_CORE_REQUESTS,
  BRIDGE_ERROR_CODES,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_RESERVED_NAMESPACE,
  BRIDGE_RESULT_TYPES,
  BRIDGE_TYPE_RE,
  MAX_REQUEST_ID_LENGTH,
} from './constants'
import { defineBridgeNamespace } from './namespace'

const CLIENT_KIND_MAX = 32

export const BridgeTypeSchema = z.string().regex(BRIDGE_TYPE_RE)
const RequestIdSchema = z.string().min(1).max(MAX_REQUEST_ID_LENGTH)

/** Every message: `{ type: '<namespace>.<name>', id?, payload }`. */
export const BridgeEnvelopeSchema = z.object({
  type: BridgeTypeSchema,
  id: RequestIdSchema.optional(),
  payload: z.unknown().default(null),
})
export type BridgeEnvelope = z.infer<typeof BridgeEnvelopeSchema>

export const BridgeErrorCodeSchema = z.enum(BRIDGE_ERROR_CODES)
export type BridgeErrorCode = z.infer<typeof BridgeErrorCodeSchema>

export const BridgeResultSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(BRIDGE_RESULT_TYPES.result), id: RequestIdSchema.optional(), payload: z.unknown() }),
  z.object({
    type: z.literal(BRIDGE_RESULT_TYPES.error),
    id: RequestIdSchema.optional(),
    error: z.object({ code: BridgeErrorCodeSchema, message: z.string() }),
  }),
])
export type BridgeResult = z.infer<typeof BridgeResultSchema>

export const BridgeClientDescriptorSchema = z.object({
  kind: z.string().min(1).max(CLIENT_KIND_MAX),
  name: z.string().optional(),
  version: z.string().optional(),
})
export type BridgeClientDescriptor = z.infer<typeof BridgeClientDescriptorSchema>

/** The reserved `bridge` namespace, handled by the server itself. */
export const bridgeCore = defineBridgeNamespace({
  name: BRIDGE_RESERVED_NAMESPACE,
  requests: {
    [BRIDGE_CORE_REQUESTS.hello]: {
      input: z.object({
        token: z.string(),
        client: BridgeClientDescriptorSchema,
        subscribe: z.array(z.string()).default([]),
      }),
      output: z.object({ clientId: z.string(), protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION) }),
    },
    [BRIDGE_CORE_REQUESTS.subscribe]: {
      input: z.object({ namespaces: z.array(z.string()) }),
      output: z.object({ namespaces: z.array(z.string()) }),
    },
    [BRIDGE_CORE_REQUESTS.ping]: {
      input: z.null().optional(),
      output: z.object({ now: z.number() }),
    },
  },
  events: {},
})
