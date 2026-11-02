import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { CornerDownRight, Image } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, SMALL_ICON_PX } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type MessageItem } from '../../../contract'
import { MessageCopy } from './lib/MessageCopy'

/** "Sent while working" under a mid-turn message until the agent takes it in. */
function MidTurnNote() {
  const t = useT()
  return (
    <span data-testid={CHAT_TESTIDS.midTurn} className="inline-flex items-center gap-1 text-[11px] text-fa">
      <CornerDownRight size={SMALL_ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
      {t('chat:message.midTurn')}
    </span>
  )
}

/** The user's message: a right-aligned bordered bubble with image chips (dashed while it waits mid-turn). */
export function UserMessage({ item }: ChatPartProps<MessageItem>) {
  return (
    <div data-testid={CHAT_TESTIDS.part(EVENT_KIND.message)} className="flex items-end justify-end gap-1">
      <div
        data-mid-turn={item.midTurn ? 'true' : undefined}
        className={cn(
          'flex max-w-[85%] flex-col gap-1.5 rounded-lg border bg-el px-3 py-2 text-[13px] text-tx',
          item.midTurn ? 'border-dashed border-bd2' : 'border-bd',
        )}
      >
        {item.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.attachments.map((a, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: attachments are immutable per message
                key={i}
                className="inline-flex items-center gap-1 rounded-sm border border-bd px-1.5 py-0.5 text-[11.5px] text-mu"
              >
                <Image size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
                {a.name}
              </span>
            ))}
          </div>
        ) : null}
        <span className="whitespace-pre-wrap break-words">{item.text}</span>
        {item.midTurn ? <MidTurnNote /> : null}
      </div>
      <MessageCopy text={item.text} className="self-end" />
    </div>
  )
}
