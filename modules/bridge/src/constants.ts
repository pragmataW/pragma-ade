/** Module-internal literals (§9); constants shared with other packages live in `contract/constants.ts`. */
export const BRIDGE_MODULE_ID = 'bridge'
export const HTTP_STATUS = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  misdirected: 421,
} as const
export const HELLO_TIMEOUT_MS = 5000
export const TOKEN_BYTES = 32
export const PRIVATE_FILE_MODE = 0o600
export const LOOPBACK_HOST = '127.0.0.1'
export const LOCALHOST_NAME = 'localhost'
export const JSON_CONTENT_TYPE = 'application/json'
export const NULL_ORIGIN = 'null'
export const HTTP_PREFIX = 'http:'
export const WS_PREFIX = 'ws:'
