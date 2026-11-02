import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { CHAT_SWITCH_MODULE_ID, type SwitchTarget } from './contract'

/** Module-internal constants of chat-switch (§9.2). */
export const SESSION_STATUS_STARTING = SESSION_STATUS.starting

const SWITCH_REASON_LIST = [
  'currentMode',
  'switching',
  'starting',
  'noResume',
  'idUnknown',
  'busy',
  'chatResumeUnsupported',
  'noChat',
] as const
export const SWITCH_REASON = Object.fromEntries(SWITCH_REASON_LIST.map((r) => [r, r])) as {
  readonly [K in (typeof SWITCH_REASON_LIST)[number]]: K
}
export const switchReasonKey = (reason: keyof typeof SWITCH_REASON): string =>
  `${CHAT_SWITCH_MODULE_ID}:reason.${reason}`

const SWITCH_ERROR_LIST = ['inProgress', 'busy', 'startFailed'] as const
export const SWITCH_ERROR = Object.fromEntries(SWITCH_ERROR_LIST.map((e) => [e, e])) as {
  readonly [K in (typeof SWITCH_ERROR_LIST)[number]]: K
}
export const switchErrorKey = (error: keyof typeof SWITCH_ERROR): string => `${CHAT_SWITCH_MODULE_ID}:error.${error}`
/** Nothing to resume: a fresh session was started in the target view. */
export const freshStartNoticeKey = (target: SwitchTarget): string => `${CHAT_SWITCH_MODULE_ID}:notice.fresh.${target}`

export const RESUME_CAPABILITY = 'resume'
export const RESUME_DECORATOR_ID = 'chat-switch.resume'
/** Before 04's status decorator (100): it must see OpenCode's `--server` to leave out `--standalone`. */
export const RESUME_DECORATOR_ORDER = 50

export const CHAT_CAPABILITY = 'chat'
export const CHAT_SWITCH_KEY_PREFIX = `${CHAT_SWITCH_MODULE_ID}:`

export const TOGGLE_SLOT_ID = 'chat-switch.view-toggle'
/** Left of 05's comments badge (50). */
export const TOGGLE_SLOT_ORDER = 10
export const TOGGLE_VARIANT = 'outline'
export const SPINNER_PX = 12
/** How long a failure or conflict stays visible under the toggle. */
export const ALERT_MS = 6000
export const CONFLICT_KEY = `${CHAT_SWITCH_MODULE_ID}:conflict.toast`
/** A turn is running: switching to the terminal interrupts it, so it is confirmed. */
export const CONFIRM_STATUSES: ReadonlySet<string> = new Set([SESSION_STATUS.working, SESSION_STATUS.waiting])
