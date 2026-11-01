import { PARTITION_PREFIX, PARTITION_REPLACEMENT, PARTITION_UNSAFE_RE } from '../constants'

/** The session partition of a worktree (cookies and storage are never shared across worktrees). */
export const partitionForWorktree = (worktreeId: string): string =>
  PARTITION_PREFIX + worktreeId.replace(PARTITION_UNSAFE_RE, PARTITION_REPLACEMENT)
