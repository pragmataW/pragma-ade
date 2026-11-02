/** Module-internal literals (§9); shared ones live in `contract/constants.ts`. */
export const DECORATOR_ID = 'agent-status.bridge-env'
export const DECORATOR_ORDER = 100
export const SLOT_ENTRY_ID = 'agent-status.badge'
export const SLOT_ORDER = 10
export const SETTINGS_PAGE_ID = 'agent-status'
export const MS_PER_SECOND = 1000
export const IDLE_SECONDS_MIN = 1
export const IDLE_SECONDS_MAX = 600
/**
 * Terminal input that is an interrupt key: Esc, Ctrl-C, and their kitty keyboard protocol forms (`CSI 27 u`,
 * `CSI 99;5 u`). Only these exact writes count (arrow keys etc. also start with ESC).
 */
export const INTERRUPT_KEYS: ReadonlySet<string> = new Set(['\x1b', '\x03', '\x1b[27u', '\x1b[99;5u'])
