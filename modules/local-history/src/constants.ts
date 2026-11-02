/** Every literal of the module lives here (§9). */
export const MODULE_ID = 'local-history'
export const IPC = {
  list: 'local-history.list',
  detail: 'local-history.detail',
  fileContent: 'local-history.fileContent',
  restore: 'local-history.restore',
  remove: 'local-history.remove',
  clear: 'local-history.clear',
  changed: 'local-history.changed',
} as const
export const COMMANDS = { show: 'localHistory.show', restoreLatest: 'localHistory.restoreLatest' } as const
export const SERVICE_ID = 'local-history.store'
export const TAB_ID = 'local-history'
export const TAB_ICON = 'rotate-ccw-clock'
/** After Git Changes (40). */
export const TAB_ORDER = 45
export const SETTINGS_PAGE_ID = 'local-history'
export const SETTINGS_PAGE_ICON = 'rotate-ccw-clock'
export const SETTINGS_ORDER = 1010

export const TABLES = {
  entries: 'local_history_entries',
  files: 'local_history_files',
  stashes: 'local_history_stashes',
} as const
export const BLOB_DIR = 'blobs'

export const RETENTION = {
  defaultDays: 7,
  minDays: 1,
  maxDays: 90,
  defaultMb: 512,
  minMb: 16,
  maxMb: 4096,
} as const
/** Expired entries are pruned at start-up, after each recording, and every 6 hours. */
export const PRUNE_INTERVAL_MS = 21_600_000
export const DAY_MS = 86_400_000
export const MB = 1_048_576
/** Files over 5 MB are listed but not saved (their content is not kept). */
export const MAX_SAVED_FILE_BYTES = 5_242_880
/** A NUL byte in the first bytes marks a file as binary (git's heuristic). */
export const BINARY_SNIFF_BYTES = 8000
export const NUL = 0

export const GIT = {
  stashStore: ['stash', 'store', '-m'],
  revParse: ['rev-parse', '--verify'],
  head: 'HEAD',
  parentSuffix: '^',
  resetSoft: ['reset', '--soft'],
} as const
export const HASH = 'sha256'
export const HEX = 'hex'
export const UTF8 = 'utf8'
/** Preview language when the extension says nothing. */
export const PLAIN_LANG = 'text'
export const SHORT_SHA = 7
export const ROW_ICON_PX = 14
export const ICONS = { restore: 'rotate-ccw', remove: 'trash' } as const
export const BUTTON = 'button'
