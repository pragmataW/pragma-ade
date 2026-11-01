/** Module-internal constants (§9); shared ones live in `contract/constants.ts`. */

export const GIT_LS_FILES_ARGS = ['ls-files', '--cached', '--others', '--exclude-standard'] as const
export const LINE_SPLIT_RE = /\r?\n/
/** `git ls-files` results are reused this long per worktree. */
export const FILE_LIST_CACHE_MS = 10_000
export const FILE_RANK = { basenamePrefix: 0, pathPrefix: 1, subsequence: 2 } as const
export const PATH_SEPARATOR = '/'
