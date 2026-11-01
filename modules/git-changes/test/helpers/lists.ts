import type { ChangedFile, ChangeList, ChangeMode, FileStatus } from '../../src/contract'
import { WT_ID } from './ids'

/** Changed files with the given paths (status M unless given, 1 addition and 1 deletion each). */
export const changed = (paths: readonly string[], status: FileStatus = 'M'): ChangedFile[] =>
  paths.map((path) => ({ path, status, additions: 1, deletions: 1, binary: false }))

/** An `ok` change list of worktree `w`; branch lists get a merge-base and 2 commits. */
export const okList = (mode: ChangeMode, files: ChangedFile[], baseBranch = 'main'): ChangeList => ({
  state: 'ok',
  worktreeId: WT_ID,
  mode,
  baseBranch,
  mergeBase: mode === 'branch' ? '0123456789abcdef' : null,
  headSha: 'feedface',
  commitCount: mode === 'branch' ? 2 : null,
  files,
  totals: {
    files: files.length,
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
  },
})

/** A `list` answer: `branch` for branch mode, `uncommitted` otherwise. */
export const listsAnswer =
  (lists: { uncommitted: ChangedFile[]; branch: ChangedFile[] | ChangeList }) =>
  (i: { mode: ChangeMode }): ChangeList => {
    if (i.mode !== 'branch') return okList('uncommitted', lists.uncommitted)
    return Array.isArray(lists.branch) ? okList('branch', lists.branch) : lists.branch
  }
