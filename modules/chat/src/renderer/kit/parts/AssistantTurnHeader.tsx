import { MARK_PX } from '../../../constants'
import { CHAT_TESTIDS, type ChatTurnHeaderProps } from '../../../contract'
import { useChatHost } from '../../host-adapter'

const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

/** Provider mark (14px) + provider name + the turn's time. */
export function AssistantTurnHeader({ session, at }: ChatTurnHeaderProps) {
  const { ProviderMark, providerName } = useChatHost()
  return (
    <div data-testid={CHAT_TESTIDS.turnHeader} className="flex items-center gap-2 text-[12px] text-mu">
      <ProviderMark providerId={session.providerId} size={MARK_PX} />
      <span className="font-semibold text-tx">{providerName(session.providerId)}</span>
      {at ? <span>{TIME.format(at)}</span> : null}
    </div>
  )
}
