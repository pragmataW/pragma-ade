/**
 * Constants shared with other packages. Imports only the bridge contract constants: the hook-side client
 * (`../client`) bundles this file into hook scripts.
 */
import { joinBridgeType } from '@pragma/module-bridge/contract'

export const AGENT_STATUS_MODULE_ID = 'agent-status'
export const AGENT_BRIDGE_NAMESPACE = 'agent'
export const AGENT_HOOK_REQUEST = 'hookEvent'
/** `agent.hookEvent` */
export const AGENT_HOOK_TYPE = joinBridgeType(AGENT_BRIDGE_NAMESPACE, AGENT_HOOK_REQUEST)
/** Nested-instance guard: only the first hook/plugin instance in a process tree reports. */
export const STATUS_CLAIMED_ENV = 'PRAGMA_STATUS_CLAIMED'
export const STATUS_CLAIMED_VALUE = '1'
export const HOOK_POST_TIMEOUT_MS = 2000
export const HOOK_FIELD_MAX_CHARS = 200
export const HOOK_ID_MAX_CHARS = 128
export const PROVIDER_ID_MAX_CHARS = 64
export const MIN_GRACE_MS = 500
export const MIN_IDLE_MS = 250
export const MAX_TIMER_MS = 600_000
export const DEFAULT_HOOK_GRACE_MS = 30_000
export const DEFAULT_ACTIVITY_IDLE_MS = 5_000

export const STATUS_EVENT_KINDS = [
  'sessionStarted',
  'promptSubmitted',
  'toolStarted',
  'toolFinished',
  'waitingForUser',
  'userResponded',
  'turnCompleted',
  'turnInterrupted',
  'turnFailed',
  'sessionEnded',
] as const
export type StatusEventKind = (typeof STATUS_EVENT_KINDS)[number]
/** `{ sessionStarted: 'sessionStarted', … }` so code names kinds instead of repeating literals. */
export const EVENT_KIND = Object.fromEntries(STATUS_EVENT_KINDS.map((k) => [k, k])) as {
  readonly [K in StatusEventKind]: K
}
export const WAIT_REASONS = ['permission', 'question', 'input'] as const
export type WaitReason = (typeof WAIT_REASONS)[number]
export const WAIT_REASON = Object.fromEntries(WAIT_REASONS.map((r) => [r, r])) as { readonly [K in WaitReason]: K }
export const STATUS_SOURCES = ['pending-hooks', 'hooks', 'activity', 'external'] as const
export type StatusSourceName = (typeof STATUS_SOURCES)[number]
export const STATUS_SOURCE = {
  pendingHooks: 'pending-hooks',
  hooks: 'hooks',
  activity: 'activity',
  external: 'external',
} as const satisfies Record<string, StatusSourceName>

export const OPEN_SESSION_COMMAND = 'agent-status.openSession'
export const AGENT_STATUS_SERVICE_ID = 'agent-status.service'
export const STATUS_CHANGED_EVENT = 'agentSession.statusChanged'
export const AGENT_STATUS_IPC = {
  list: 'agent-status.list',
  sessionChanged: 'agent-status.sessionChanged',
  worktreeChanged: 'agent-status.worktreeChanged',
} as const
