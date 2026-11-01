// Hook-side sender (`@pragma/module-agent-status/client`), bundled into provider hook scripts: no zod, no SDK.
import { AGENT_ENV } from '@pragma/module-agents/contract'
import { BRIDGE_ENV, postBridgeMessage } from '@pragma/module-bridge/client'
import {
  AGENT_HOOK_TYPE,
  HOOK_FIELD_MAX_CHARS,
  HOOK_POST_TIMEOUT_MS,
  STATUS_CLAIMED_ENV,
  STATUS_CLAIMED_VALUE,
} from '../contract/constants'

export interface HookEnv {
  bridgeUrl: string
  bridgeToken: string
  sessionId: string
}

/** The bridge connection and session id from the agent's env; null unless all three are set. */
export function readHookEnv(env: Record<string, string | undefined>): HookEnv | null {
  const bridgeUrl = env[BRIDGE_ENV.url]
  const bridgeToken = env[BRIDGE_ENV.token]
  const sessionId = env[AGENT_ENV.sessionId]
  return bridgeUrl && bridgeToken && sessionId ? { bridgeUrl, bridgeToken, sessionId } : null
}

/** A string cut to `HOOK_FIELD_MAX_CHARS`; anything else → undefined. */
export function truncateField(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, HOOK_FIELD_MAX_CHARS) : undefined
}

/** Posts one `agent.hookEvent`; never throws (a hook must never block or fail the agent). */
export async function sendHookEvent(
  hookEnv: HookEnv,
  providerId: string,
  event: Record<string, unknown>,
): Promise<void> {
  try {
    await postBridgeMessage(
      { url: hookEnv.bridgeUrl, token: hookEnv.bridgeToken },
      { type: AGENT_HOOK_TYPE, payload: { sessionId: hookEnv.sessionId, providerId, event } },
      { timeoutMs: HOOK_POST_TIMEOUT_MS },
    )
  } catch {
    // the app may be gone or busy; status then falls back to activity detection
  }
}

/** Sequential sender: each event is posted after the previous one settled (order is preserved). */
export function createSendQueue(
  hookEnv: HookEnv,
  providerId: string,
): (event: Record<string, unknown>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve()
  return (event) => {
    tail = tail.then(() => sendHookEvent(hookEnv, providerId, event))
    return tail
  }
}

/** Nested-agent guard: false when an outer instance already reports; otherwise marks the env and returns true. */
export function claimStatusReporter(env: Record<string, string | undefined>): boolean {
  if (env[STATUS_CLAIMED_ENV] === STATUS_CLAIMED_VALUE) return false
  env[STATUS_CLAIMED_ENV] = STATUS_CLAIMED_VALUE
  return true
}
