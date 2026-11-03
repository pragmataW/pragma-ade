import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Square } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, SIZE_SM, VARIANT_OUTLINE } from '../../../constants'
import { CHAT_TESTIDS, type ChatSessionStatus, type ChatSlotProps } from '../../../contract'
import { CHAT_RESPONSIVE } from '../responsive'

const BUSY = new Set<ChatSessionStatus>([SESSION_STATUS.working, SESSION_STATUS.waiting])
export const isBusy = (status: ChatSessionStatus): boolean => BUSY.has(status)

/** Interrupts the turn; visible while the agent works or waits. */
export function StopButton({ session }: ChatSlotProps) {
  const t = useT()
  if (!isBusy(session.status)) return null
  return (
    <Button
      variant={VARIANT_OUTLINE}
      size={SIZE_SM}
      data-testid={CHAT_TESTIDS.stop}
      title={t('chat:composer.stop')}
      onClick={() => void session.interrupt()}
      className="shrink-0 gap-1 px-2 text-[12px]"
    >
      <Square size={ICON_PX} strokeWidth={ICON_STROKE} className="fill-current" aria-hidden />
      <span className={CHAT_RESPONSIVE.label}>{t('chat:composer.stop')}</span>
    </Button>
  )
}
