import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { useShallow } from 'zustand/react/shallow'
import { AGENT_STATUS_TEST_IDS as T } from '../contract'
import { countActive } from '../lib/status-rules'
import { ICON_SIZE, StatusIcon } from './StatusIcon'
import { useAgentStatusStore } from './store'

const ITEMS = [
  {
    key: 'working',
    status: SESSION_STATUS.working,
    testId: T.statusbarWorking,
    labelKey: 'agent-status:statusbar.working',
  },
  {
    key: 'waiting',
    status: SESSION_STATUS.waiting,
    testId: T.statusbarWaiting,
    labelKey: 'agent-status:statusbar.waiting',
  },
] as const

/** `statusbar.right`: app-wide working / waiting agent counts (hidden at 0/0; a zero item is hidden). */
export function StatusbarCounts() {
  const t = useT()
  const counts = useAgentStatusStore(useShallow((s) => countActive(Object.values(s.sessions))))
  if (counts.working === 0 && counts.waiting === 0) return null
  const format = new Intl.NumberFormat()
  return (
    <span data-testid={T.statusbarCounts} className="flex items-center gap-3">
      {ITEMS.filter((i) => counts[i.key] > 0).map((i) => (
        <span
          key={i.key}
          data-testid={i.testId}
          className={i.key === 'waiting' ? 'flex items-center gap-1 text-warn' : 'flex items-center gap-1'}
        >
          <StatusIcon status={i.status} turnCompleted={false} size={ICON_SIZE.sm} />
          {t(i.labelKey, { count: counts[i.key], formatted: format.format(counts[i.key]) })}
        </span>
      ))}
    </span>
  )
}
