import { TerminalViewServiceToken } from '@pragma/module-terminal/contract'
import { NOTICE_VARIANT } from '../../constants'
import { type AgentSessionViewProps, isRunningStatus, SESSION_STATUS } from '../../contract'
import { getRuntime } from '../runtime'
import { SessionEndedNotice } from './SessionEndedNotice'

/** `agentSession.view` entry for `terminal` mode: the agent's pty (02's TerminalView) or the ended placeholder. */
export function TerminalSessionView({ session, active }: AgentSessionViewProps) {
  const { TerminalView } = getRuntime().ctx.services.get(TerminalViewServiceToken)
  const failed = session.status === SESSION_STATUS.error
  if (failed || !session.attachable || !session.ptyId)
    return <SessionEndedNotice session={session} variant={NOTICE_VARIANT.placeholder} />
  return (
    <div className="flex h-full min-h-0 flex-col">
      {isRunningStatus(session.status) ? null : (
        <SessionEndedNotice session={session} variant={NOTICE_VARIANT.banner} />
      )}
      <TerminalView key={session.ptyId} ptyId={session.ptyId} autoFocus={active} className="min-h-0 flex-1" />
    </div>
  )
}
