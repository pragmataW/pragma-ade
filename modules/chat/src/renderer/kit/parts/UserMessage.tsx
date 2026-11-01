import { Image } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type MessageItem } from '../../../contract'

/** The user's message: a right-aligned bordered bubble with image chips. */
export function UserMessage({ item }: ChatPartProps<MessageItem>) {
  return (
    <div data-testid={CHAT_TESTIDS.part(EVENT_KIND.message)} className="flex justify-end">
      <div className="flex max-w-[85%] flex-col gap-1.5 rounded-lg border border-bd bg-el px-3 py-2 text-[13px] text-tx">
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
      </div>
    </div>
  )
}
