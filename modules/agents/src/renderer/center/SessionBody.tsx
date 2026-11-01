import { Slot, useT } from '@pragma/sdk/renderer'
import { AGENT_SLOTS, AGENTS_TESTIDS, type AgentSession, type AgentSessionViewProps } from '../../contract'

/** The first `agentSession.view` entry whose `match` accepts the active session (only the active tab is mounted). */
export function SessionBody({ session }: { session: AgentSession }) {
  const t = useT()
  return (
    <div data-testid={AGENTS_TESTIDS.sessionBody} data-session-id={session.id} className="min-h-0 flex-1">
      <Slot<AgentSessionViewProps>
        id={AGENT_SLOTS.view}
        props={{ session, active: true }}
        single
        fallback={<div className="p-4 text-mu">{t('agents:errors.modeUnavailable')}</div>}
      />
    </div>
  )
}
