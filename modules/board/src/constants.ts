/** Module-internal literals (§9.2); anything other modules need lives in `contract/constants.ts`. */

/** Branch slug cap (ui-notes: `feat/<key>-<slug>`). */
export const SLUG_MAX_CHARS = 40
export const KEY_PREFIX_LENGTH = 3
export const FALLBACK_KEY_PREFIX = 'TSK'
export const BRANCH_PREFIX = 'feat/'
export const SLUG_SEPARATOR = '-'
export const PROMPT_SEPARATOR = '\n\n'
export const NON_SLUG_CHARS_RE = /[^a-z0-9]+/g
/** First suffix for a taken name: `PRA` → `PRA2`, `feat/x` → `feat/x-2`. */
export const FIRST_DUPLICATE_SUFFIX = 2
/** `PRA-12` (prefix letters/digits, task number). */
export const TASK_KEY_RE = /^(?<prefix>[A-Za-z0-9]+)-(?<number>\d+)$/
export const DIGITS_RE = /^\d+$/
/** `prepareStart` tries `<branch>-2` … `<branch>-50` before giving up on a free suggestion. */
export const MAX_BRANCH_SUFFIX = 50
export const REMOTE_HEAD_RE = /\/HEAD$/
/** Coalesces bursts of `board.changed` into one renderer push. */
export const CHANGE_PUSH_DEBOUNCE_MS = 50
export const WORKTREE_FILTERS = ['any', 'with', 'without'] as const
/** Agent filter value for "tasks without a linked session". */
export const NO_AGENT_FILTER_VALUE = 'none'
export const VIEW_MODES = ['board', 'list'] as const
