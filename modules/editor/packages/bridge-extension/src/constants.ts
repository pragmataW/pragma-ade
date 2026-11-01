/** Extension-local constants (§9.2); shared names come from `@pragma/module-editor/contract`. */
export const LOG_CHANNEL = 'Pragma Bridge'
export const MESSAGES = {
  disabledNoFolder: 'Pragma bridge disabled: no workspace folder.',
  disabledNoBridge: 'Pragma bridge disabled: no bridge configuration.',
  connected: 'Pragma bridge connected.',
  helloFailed: 'Pragma bridge hello failed: ',
  offline: 'Pragma bridge is not connected.',
} as const
export const RECONNECT = { enabled: true } as const
