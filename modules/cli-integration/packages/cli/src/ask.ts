import {
  ASK_DEADLINE_MARGIN_MS,
  ASK_DEFAULT_TIMEOUT_SECONDS,
  ASK_REQUEST_TIMEOUT_MS,
  ASK_STATE,
  CLI_ERROR,
  CLI_METHOD,
  type CliCallerContext,
  type CliResult,
  MS_PER_S,
} from '@pragma/module-cli-integration/contract'
import { AppError } from './client'
import type { BridgeEndpoint } from './connection'
import type { CliDeps } from './main'

/** The `ask` payload as the CLI builds it (`timeoutSeconds` is optional; the app defaults it). */
export interface AskPayload {
  context: CliCallerContext
  to: string
  prompt: string
  timeoutSeconds?: number
}

type AskResult = CliResult<'ask'>

/**
 * `pragma ask`: starts the question, then long-polls `askWait` until the answer arrives. Each request is held at
 * most the server's poll wait, so no single HTTP request outlives the transport's header timeout.
 */
export async function callAsk(
  call: CliDeps['call'],
  ep: BridgeEndpoint,
  payload: AskPayload,
  now: () => number = Date.now,
): Promise<AskResult> {
  const seconds = payload.timeoutSeconds ?? ASK_DEFAULT_TIMEOUT_SECONDS
  const deadline = now() + seconds * MS_PER_S + ASK_DEADLINE_MARGIN_MS
  const opts = { timeoutMs: ASK_REQUEST_TIMEOUT_MS }
  let result = (await call(ep, CLI_METHOD.ask, payload, opts)) as AskResult
  while (result.status === ASK_STATE.pending) {
    if (now() > deadline) throw new AppError(CLI_ERROR.timeout, `No answer within ${seconds} s.`)
    const waitPayload = { context: payload.context, askId: result.askId }
    result = (await call(ep, CLI_METHOD.askWait, waitPayload, opts)) as AskResult
  }
  return result
}
