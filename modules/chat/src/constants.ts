/** Module-internal constants (§9); shared ones live in `contract/constants.ts`. */

export const GIT_LS_FILES_ARGS = ['ls-files', '--cached', '--others', '--exclude-standard'] as const
export const LINE_SPLIT_RE = /\r?\n/
/** `git ls-files` results are reused this long per worktree. */
export const FILE_LIST_CACHE_MS = 10_000
export const FILE_RANK = { basenamePrefix: 0, pathPrefix: 1, subsequence: 2 } as const
export const PATH_SEPARATOR = '/'

/** Renderer registrations. */
export const CHAT_SLOT_ENTRY_ID = 'chat'
export const CHAT_VIEW_ORDER = 20
export const CHAT_MODE_OPTION_ID = 'chat.mode'
export const CHAT_STATUSBAR_ID = 'chat.context'
export const CHAT_STATUSBAR_ORDER = 60
export const CHAT_SETTINGS_ICON = 'message-square'
export const PERCENT = 100
/** Kit metrics (ui-notes). */
export const CONTEXT_WARN_RATIO = 0.8
export const RING = { box: 14, c: 7, r: 5.5, stroke: 1.5 } as const
