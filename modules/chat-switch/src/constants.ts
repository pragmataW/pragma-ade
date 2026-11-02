import { CHAT_SWITCH_MODULE_ID } from './contract'

/** Module-internal constants of chat-switch (§9.2). */
export const SESSION_STATUS_STARTING = 'starting'

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

export const RESUME_CAPABILITY = 'resume'
export const RESUME_DECORATOR_ID = 'chat-switch.resume'
/** Before 04's status decorator (100): it must see OpenCode's `--server` to leave out `--standalone`. */
export const RESUME_DECORATOR_ORDER = 50
