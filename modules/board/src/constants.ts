/** Module-internal literals (§9.2); anything other modules need lives in `contract/constants.ts`. */

/** Branch slug cap (ui-notes: `feat/<key>-<slug>`). */
export const SLUG_MAX_CHARS = 40
export const KEY_PREFIX_LENGTH = 3
export const FALLBACK_KEY_PREFIX = 'TSK'
export const BRANCH_PREFIX = 'feat/'
export const SLUG_SEPARATOR = '-'
export const PROMPT_SEPARATOR = '\n\n'
export const NON_SLUG_CHARS_RE = /[^a-z0-9]+/g
