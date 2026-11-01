import { useShallow } from 'zustand/react/shallow'
import { AGENT_STATUS_TEST_IDS as T } from '../contract'
import { summarize } from '../lib/status-rules'
import { ICON_SIZE, StatusIcon } from './StatusIcon'
import { useAgentStatusStore } from './store'

/** `board.card.badges` props (§10.3; 09 passes the task's linked sessions). */
export interface BoardCardBadgeProps {
  taskId: number | string
  sessionIds: string[]
}

/** The most urgent status of the card's known sessions; nothing when none is tracked. */
export function BoardCardBadge({ sessionIds }: BoardCardBadgeProps) {
  const known = useAgentStatusStore(useShallow((s) => sessionIds.flatMap((id) => s.sessions[id] ?? [])))
  const summary = summarize(known)
  if (summary.sessionCount === 0 || !summary.status) return null
  return (
    <span data-testid={T.cardBadge} className="flex">
      <StatusIcon status={summary.status} turnCompleted={summary.turnCompleted} size={ICON_SIZE.sm} />
    </span>
  )
}
