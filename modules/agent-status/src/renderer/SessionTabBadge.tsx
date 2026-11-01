import type { AgentSessionTabBadgesProps } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { AGENT_STATUS_DATA_ATTRS as A, AGENT_STATUS_TEST_IDS as T } from '../contract'
import { ICON_SIZE, StatusIcon } from './StatusIcon'
import { statusVisual } from './status-visual'
import { useAgentStatusStore } from './store'

const DETAIL_SEPARATOR = ' · '

/** `agentSession.tab.badges`: the live status (falls back to the session row's status before the first update). */
export function SessionTabBadge({ session }: AgentSessionTabBadgesProps) {
  const t = useT()
  const info = useAgentStatusStore((s) => s.sessions[session.id])
  const status = info?.status ?? session.status
  const turnCompleted = info?.turnCompleted ?? false
  const label = t(statusVisual(status, turnCompleted).labelKey)
  const title = info?.detail ? `${label}${DETAIL_SEPARATOR}${info.detail}` : label
  return (
    <span
      data-testid={T.tabBadge}
      {...{ [A.sessionId]: session.id, [A.status]: status }}
      title={title}
      className="flex"
    >
      <StatusIcon status={status} turnCompleted={turnCompleted} size={ICON_SIZE.sm} />
    </span>
  )
}
