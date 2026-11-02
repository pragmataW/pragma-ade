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
