import { useT } from '@pragma/sdk/renderer'
import { PROJECTS_TESTIDS as T, type WorktreeRowSlotProps } from '../../contract'
import { useProjects } from '../lib/runtime'

const NUMBER = new Intl.NumberFormat()

/** `sidebar.worktreeRow.badges` entry: the changed-file count, hidden at 0. */
export function ChangedFilesBadge({ worktreeId }: WorktreeRowSlotProps) {
  const t = useT()
  const count = useProjects((s) => s.changedFiles[worktreeId] ?? 0)
  if (count <= 0) return null
  const label = t('projects:sidebar.changedFiles', { count })
  return (
    <span
      data-testid={T.changedCount}
      role="status"
      aria-label={label}
      title={label}
      className="rounded-[var(--radius-chip)] border border-bd2 bg-el px-1.5 font-medium text-[10.5px] text-mu tabular-nums leading-4"
    >
      {NUMBER.format(count)}
    </span>
  )
}
