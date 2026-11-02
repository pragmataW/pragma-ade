/** Shared ids of `@pragma/module-chat-switch` (renderer-safe). */
export const CHAT_SWITCH_MODULE_ID = 'chat-switch'

export const CHAT_SWITCH_IPC = {
  eligibility: 'chat-switch.eligibility',
  switch: 'chat-switch.switch',
  testGuardOwner: 'chat-switch.test.guardOwner',
  testDisableRetain: 'chat-switch.test.disableRetain',
} as const

export const CHAT_SWITCH_IPC_EVENTS = {
  changed: 'chat-switch.changed',
  conflict: 'chat-switch.conflict',
} as const

export const CHAT_SWITCH_SERVICE_IDS = { guard: 'chat-switch.guard', service: 'chat-switch.service' } as const
