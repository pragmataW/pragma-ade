import {
  type BridgeConnection,
  BridgeRequestError,
  BridgeUnavailableError,
  joinBridgeType,
  postBridgeMessage,
} from '@pragma/module-bridge/client'
import { BRIDGE_ERROR, BRIDGE_UNAVAILABLE } from '@pragma/module-bridge/contract'
import {
  ASK_REQUEST_TIMEOUT_MS,
  CLI_ERROR,
  CLI_METHOD,
  CLI_NAMESPACE,
  CLI_PING_METHOD,
  type CliErrorCode,
  type CliMethod,
  cliResponseSchema,
  cliResultSchemas,
} from '@pragma/module-cli-integration/contract'
import { NotRunningError } from './connection'
import {
  CLI_DISABLED,
  CONNECT_TIMEOUT_MS,
  NOT_RUNNING_HINTS,
  RESPONSE_TIMEOUT_MS,
  TOKEN_REJECTED,
  UNREACHABLE,
  VERSION_MISMATCH,
} from './constants'

/** The app answered with an error: exit code 1. */
export class AppError extends Error {
  readonly code: CliErrorCode
  readonly details: Record<string, unknown> | undefined
  constructor(code: CliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export interface CallOptions {
  /** Liveness probe timeout (stale `bridge.json`, silent port). */
  connectTimeoutMs?: number
  /** The real request's timeout. */
  timeoutMs?: number
}

function mapTransportError(e: unknown, conn: BridgeConnection): never {
  if (e instanceof BridgeUnavailableError) {
    if (e.reason === BRIDGE_UNAVAILABLE.unauthorized)
      throw new NotRunningError(TOKEN_REJECTED, NOT_RUNNING_HINTS.tokenRejected)
    throw new NotRunningError(UNREACHABLE, NOT_RUNNING_HINTS.unreachable(conn.url))
  }
  if (e instanceof BridgeRequestError && e.code === BRIDGE_ERROR.unknown_type)
    throw new AppError(CLI_ERROR.internal, CLI_DISABLED)
  if (e instanceof BridgeRequestError) throw new AppError(CLI_ERROR.internal, e.message)
  throw e
}

async function post(conn: BridgeConnection, name: string, payload: unknown, timeoutMs: number): Promise<unknown> {
  try {
    return await postBridgeMessage(conn, { type: joinBridgeType(CLI_NAMESPACE, name), payload }, { timeoutMs })
  } catch (e) {
    return mapTransportError(e, conn)
  }
}

/** Long-poll methods hold a request up to the server's poll wait; every other method keeps the default. */
const LONG_POLL_METHODS = new Set<CliMethod>([CLI_METHOD.ask, CLI_METHOD.askWait])

/** Per-request response timeout of `method`. */
export function requestTimeoutMs(method: CliMethod): number {
  return LONG_POLL_METHODS.has(method) ? ASK_REQUEST_TIMEOUT_MS : RESPONSE_TIMEOUT_MS
}

/** Probes the bridge with a short timeout, sends `cli.<method>` and validates the answer. */
export async function callBridge(
  conn: BridgeConnection,
  method: CliMethod,
  payload: unknown,
  opts: CallOptions = {},
): Promise<unknown> {
  await post(conn, CLI_PING_METHOD, {}, opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS)
  const raw = await post(conn, method, payload, opts.timeoutMs ?? requestTimeoutMs(method))
  const response = cliResponseSchema.safeParse(raw)
  if (!response.success) throw new AppError(CLI_ERROR.internal, VERSION_MISMATCH)
  if (!response.data.ok) {
    const { code, message, details } = response.data.error
    throw new AppError(code, message, details)
  }
  const result = cliResultSchemas[method].safeParse(response.data.result)
  if (!result.success) throw new AppError(CLI_ERROR.internal, VERSION_MISMATCH)
  return result.data
}
