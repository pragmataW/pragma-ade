/** Module-internal named constants (§9). Anything other modules need lives in `src/contract/`. */
export const MODULE_ID = 'projects'

/** Absolute POSIX/Windows path, or one starting with `~`. */
export const ABSOLUTE_OR_HOME_PATH_RE = /^(~|\/|[A-Za-z]:[\\/]|\\\\)/
export const DEFAULT_WORKTREES_ROOT = '~/pragma/worktrees'

/** `git status --porcelain=v2`: space-separated fields before the path, per record tag. */
export const STATUS_RECORD_FIELDS = { '1': 8, '2': 9, u: 10, '?': 1 } as const
export const STATUS_HEADER_PREFIX = '# '
export const STATUS_HEADERS = {
  oid: 'branch.oid',
  head: 'branch.head',
  upstream: 'branch.upstream',
  ab: 'branch.ab',
} as const
export const STATUS_INITIAL_OID = '(initial)'
export const STATUS_DETACHED_HEAD = '(detached)'
export const STATUS_AB_RE = /^\+(?<ahead>\d+) -(?<behind>\d+)$/
export const UNTRACKED_XY = '?'

/** `git worktree list --porcelain` attribute names. */
export const WORKTREE_ATTRS = {
  worktree: 'worktree',
  head: 'HEAD',
  branch: 'branch',
  bare: 'bare',
  detached: 'detached',
  locked: 'locked',
  prunable: 'prunable',
} as const

export const REF_PREFIXES = { heads: 'refs/heads/', remotes: 'refs/remotes/' } as const
export const REMOTE_HEAD_SUFFIX = '/HEAD'
export const NUL = '\0'
export const NEWLINE = '\n'
export const SPACE = ' '
