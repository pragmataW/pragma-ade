import type { WorktreeRowSlotProps } from '@pragma/module-projects/contract'
import { useT } from '@pragma/sdk/renderer'
import { AGENT_STATUS_DATA_ATTRS as A, AGENT_STATUS_TEST_IDS as T } from '../contract'
import { StatusIcon } from './StatusIcon'
import { useAgentStatusStore } from './store'

const useWorktree = (worktreeId: string) => useAgentStatusStore((s) => s.worktrees[worktreeId])

/** `sidebar.worktreeRow.leading`: the most urgent status of the worktree's agents (ui-notes: icon before the branch). */
export function WorktreeRowStatus({ worktreeId }: WorktreeRowSlotProps) {
  const w = useWorktree(worktreeId)
  if (!w?.status) return null
  return (
    <span data-testid={T.worktreeBadge} {...{ [A.worktreeId]: worktreeId, [A.status]: w.status }} className="flex">
      <StatusIcon status={w.status} turnCompleted={w.turnCompleted} />
    </span>
  )
}

/** `sidebar.worktreeRow.badges`: accent pill with the number of unread agent updates. */
export function WorktreeRowUnread({ worktreeId }: WorktreeRowSlotProps) {
  const t = useT()
  const w = useWorktree(worktreeId)
  if (!w || w.unreadCount === 0) return null
  return (
    <span
      data-testid={T.unread}
      {...{ [A.worktreeId]: worktreeId }}
      className="min-w-[16px] rounded-full bg-ac px-1.5 text-center font-semibold text-[10.5px] text-acfg leading-[16px]"
    >
      <span aria-hidden>{new Intl.NumberFormat().format(w.unreadCount)}</span>
      <span className="sr-only">{t('agent-status:unread.label', { count: w.unreadCount })}</span>
    </span>
  )
}
