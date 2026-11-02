import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { cn } from '@pragma/ui'
import { Check, Circle, CircleDashed, LoaderCircle, X } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE } from '../../../../constants'
import type { ChatSessionStatus } from '../../../../contract'
import { useChatHost } from '../../../host-adapter'

export const CHAT_FALLBACK_ICON_TESTID = 'chat-status-fallback'

const FALLBACK: Record<ChatSessionStatus, { Icon: typeof Check; className: string }> = {
  [SESSION_STATUS.starting]: { Icon: CircleDashed, className: 'text-mu' },
  [SESSION_STATUS.working]: { Icon: LoaderCircle, className: 'animate-spin text-info motion-reduce:animate-none' },
  [SESSION_STATUS.waiting]: { Icon: Circle, className: 'fill-current text-warn' },
  [SESSION_STATUS.idle]: { Icon: Check, className: 'text-ok' },
  [SESSION_STATUS.error]: { Icon: X, className: 'text-err' },
  [SESSION_STATUS.exited]: { Icon: Circle, className: 'text-fa' },
}

/** 04's `StatusIcon` (shape + colour) when agent-status is active, else a lucide fallback. */
export function StatusGlyph({ status, turnCompleted }: { status: ChatSessionStatus; turnCompleted: boolean }) {
  const { StatusIcon } = useChatHost()
  if (StatusIcon) return <StatusIcon status={status} turnCompleted={turnCompleted} size="md" />
  const { Icon, className } = FALLBACK[status]
  return (
    <Icon
      size={ICON_PX}
      strokeWidth={ICON_STROKE}
      data-testid={CHAT_FALLBACK_ICON_TESTID}
      data-status={status}
      className={cn('shrink-0', className)}
    />
  )
}
