import { useT } from '@pragma/sdk/renderer'
import {
  CHAT_TESTIDS,
  type ChatPartProps,
  EVENT_KIND,
  SESSION_EXIT_REASON,
  type SessionExitItem,
  type TurnEndItem,
} from '../../../contract'

function Divider({ testId, text }: { testId: string; text: string }) {
  return (
    <div data-testid={testId} className="flex items-center gap-3 text-[11.5px] text-mu">
      <span className="h-px flex-1 bg-bd" />
      {text}
      <span className="h-px flex-1 bg-bd" />
    </div>
  )
}

/** "Interrupted" / "Turn failed" / "Turn limit reached". */
export function TurnEndNotice({ item }: ChatPartProps<TurnEndItem>) {
  const t = useT()
  return <Divider testId={CHAT_TESTIDS.part(EVENT_KIND.turnEnd)} text={t(`chat:notice.${item.reason}`)} />
}

/** "Session ended" or "The agent process exited unexpectedly". */
export function SessionExitNotice({ item }: ChatPartProps<SessionExitItem>) {
  const t = useT()
  const key = item.reason === SESSION_EXIT_REASON.crashed ? 'chat:notice.crashed' : 'chat:notice.exited'
  return <Divider testId={CHAT_TESTIDS.part(EVENT_KIND.sessionExit)} text={t(key)} />
}
