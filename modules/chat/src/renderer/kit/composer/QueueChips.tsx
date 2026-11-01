import { useT } from '@pragma/sdk/renderer'
import { X } from '@pragma/ui/icons'
import { BUTTON_TYPE, ICON_PX, ICON_STROKE, QUEUE_CHIP_CHARS } from '../../../constants'
import { CHAT_TESTIDS, type ChatSessionApi } from '../../../contract'

const ELLIPSIS = '…'
const clip = (t: string) => (t.length > QUEUE_CHIP_CHARS ? `${t.slice(0, QUEUE_CHIP_CHARS)}${ELLIPSIS}` : t)

/** Messages sent during a turn, waiting for it to end; each can be removed. */
export function QueueChips({ session }: { session: ChatSessionApi }) {
  const t = useT()
  const queue = session.transcript.queue
  if (queue.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-mu">{t('chat:composer.queued')}</span>
      {queue.map((q) => (
        <span
          key={q.id}
          data-testid={CHAT_TESTIDS.queueChip}
          className="inline-flex max-w-full items-center gap-1 rounded-sm border border-bd bg-pn px-1.5 py-0.5 text-[11.5px] text-tx"
        >
          <span className="truncate">{clip(q.text)}</span>
          <button
            type={BUTTON_TYPE}
            data-testid={CHAT_TESTIDS.queueChipRemove}
            aria-label={t('chat:composer.removeQueued')}
            title={t('chat:composer.removeQueued')}
            onClick={() => void session.cancelQueued(q.id)}
            className="text-mu hover:text-tx"
          >
            <X size={ICON_PX} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      ))}
    </div>
  )
}
