/** Module-internal named constants (§9). Anything other modules need lives in `src/contract/`. */
export const MODULE_ID = 'projects'

/** Absolute POSIX/Windows path, or one starting with `~`. */
export const ABSOLUTE_OR_HOME_PATH_RE = /^(~|\/|[A-Za-z]:[\\/]|\\\\)/
export const DEFAULT_WORKTREES_ROOT = '~/pragma/worktrees'
