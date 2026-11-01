// Bundle-safe: imports only `contract/constants.ts` and `errors.ts` (no zod, no SDK).
import {
  BRIDGE_AUTH,
  BRIDGE_ERROR_CODES,
  BRIDGE_PATHS,
  BRIDGE_RESULT_TYPES,
  BRIDGE_UNAVAILABLE,
  type BridgeErrorCodeName,
  CLIENT_POST_TIMEOUT_MS,
  HTTP_UNAUTHORIZED,
} from '../contract/constants'
import { BridgeRequestError, BridgeUnavailableError } from './errors'

export interface BridgeConnection {
  url: string
  token: string
}

const POST = 'POST'
const JSON_TYPE = 'application/json'

interface ResultShape {
  type?: unknown
  payload?: unknown
  error?: { code?: unknown; message?: unknown }
}

const isErrorCode = (v: unknown): v is BridgeErrorCodeName => (BRIDGE_ERROR_CODES as readonly unknown[]).includes(v)

async function send(conn: BridgeConnection, body: string, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(new URL(BRIDGE_PATHS.hook, conn.url), {
      method: POST,
      headers: { [BRIDGE_AUTH.header]: `${BRIDGE_AUTH.scheme} ${conn.token}`, 'content-type': JSON_TYPE },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable, `bridge unreachable at ${conn.url}: ${String(e)}`)
  }
}

/** POSTs one envelope to `/hook` and returns the result payload. */
export async function postBridgeMessage(
  conn: BridgeConnection,
  msg: { type: string; payload: unknown },
  opts: { timeoutMs?: number } = {},
): Promise<unknown> {
  const res = await send(conn, JSON.stringify(msg), opts.timeoutMs ?? CLIENT_POST_TIMEOUT_MS)
  if (res.status === HTTP_UNAUTHORIZED) throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unauthorized)
  let result: ResultShape
  try {
    result = (await res.json()) as ResultShape
  } catch (e) {
    throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable, `invalid bridge response: ${String(e)}`)
  }
  if (result.type === BRIDGE_RESULT_TYPES.result) return result.payload
  const code = isErrorCode(result.error?.code) ? result.error.code : 'bad_request'
  throw new BridgeRequestError(code, typeof result.error?.message === 'string' ? result.error.message : code)
}
