/**
 * Bridge constants shared with other packages. NO imports: this file is bundled into hook scripts through `./client`.
 * `PRAGMA_USER_DATA` is the SDK's `USER_DATA_ENV` (not redefined here).
 */
export const BRIDGE_ENV = {
  url: 'PRAGMA_BRIDGE_URL',
  token: 'PRAGMA_BRIDGE_TOKEN',
  file: 'PRAGMA_BRIDGE_FILE',
} as const
export const BRIDGE_INFO_FILE = 'bridge.json'
export const BRIDGE_PATHS = { hook: '/hook', ws: '/ws' } as const
export const BRIDGE_AUTH = { header: 'authorization', scheme: 'Bearer' } as const
export const BRIDGE_MAX_BODY_BYTES = 1_048_576
export const BRIDGE_PROTOCOL_VERSION = 1
export const BRIDGE_RESERVED_NAMESPACE = 'bridge'
export const BRIDGE_RESULT_TYPES = { result: 'bridge.result', error: 'bridge.error' } as const
export const BRIDGE_ERROR_CODES = [
  'unauthorized',
  'bad_request',
  'unknown_type',
  'invalid_payload',
  'handler_error',
  'timeout',
  'payload_too_large',
] as const
export type BridgeErrorCodeName = (typeof BRIDGE_ERROR_CODES)[number]
/** `{ unauthorized: 'unauthorized', … }`, so code names error codes instead of repeating literals. */
export const BRIDGE_ERROR = Object.fromEntries(BRIDGE_ERROR_CODES.map((c) => [c, c])) as {
  readonly [K in BridgeErrorCodeName]: K
}
export const BRIDGE_WS_CLOSE = { unauthorized: 4401 } as const
export const BRIDGE_TYPE_SEPARATOR = '.'
export const BRIDGE_TYPE_RE = /^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9.-]*$/
export const MAX_REQUEST_ID_LENGTH = 128
export const MIN_TOKEN_LENGTH = 16
export const BRIDGE_CORE_REQUESTS = { hello: 'hello', subscribe: 'subscribe', ping: 'ping' } as const
export const BRIDGE_TRANSPORTS = ['ws', 'http'] as const
export const BRIDGE_INFO_SOURCES = ['env', 'file'] as const

export function joinBridgeType(namespace: string, name: string): string {
  return `${namespace}${BRIDGE_TYPE_SEPARATOR}${name}`
}

/** Splits at the first separator: `editor.open.file` → `{ namespace: 'editor', name: 'open.file' }`. */
export function splitBridgeType(type: string): { namespace: string; name: string } {
  const at = type.indexOf(BRIDGE_TYPE_SEPARATOR)
  if (at < 0) return { namespace: type, name: '' }
  return { namespace: type.slice(0, at), name: type.slice(at + 1) }
}
