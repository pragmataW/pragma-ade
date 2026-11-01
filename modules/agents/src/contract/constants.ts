/** Constants shared with other modules (§9); module-internal ones live in `../constants.ts`. */

/** Prompts longer than this go to a temp file and the agent gets a one-line instruction instead. */
export const INLINE_PROMPT_MAX_CHARS = 16_000
export const LONG_PROMPT_FILE = 'initial-prompt.md'
/** The first `major.minor.patch` in a version banner. */
export const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/
