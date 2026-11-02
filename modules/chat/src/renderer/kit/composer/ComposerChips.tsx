import { useT } from '@pragma/sdk/renderer'
import { MessageSquareText, X } from '@pragma/ui/icons'
import { BUTTON_TYPE, ICON_PX, ICON_STROKE, NEWLINE } from '../../../constants'
import { CHAT_TESTIDS, type ComposerChipEntry } from '../../../contract'

/** 11c: review comments waiting in the composer (one chip per delivery); the tooltip lists their `file:line`. */
export function ComposerChips({
  chips,
  onRemove,
}: {
  chips: readonly ComposerChipEntry[]
  onRemove(id: string): void
}) {
  const t = useT()
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2">
      {chips.map((c) => (
        <span
          key={c.id}
          data-testid={CHAT_TESTIDS.composerChip}
          data-count={c.labels.length}
          title={c.labels.join(NEWLINE)}
          className="inline-flex max-w-full items-center gap-1 rounded-sm border border-bd bg-acs px-1.5 py-0.5 text-[11.5px] text-tx"
        >
          <MessageSquareText size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-ac" />
          <span className="truncate">{t('chat:composer.commentsChip', { count: c.labels.length })}</span>
          <button
            type={BUTTON_TYPE}
            data-testid={CHAT_TESTIDS.composerChipRemove}
            aria-label={t('chat:composer.removeChip')}
            title={t('chat:composer.removeChip')}
            onClick={() => onRemove(c.id)}
            className="text-mu hover:text-tx"
          >
            <X size={ICON_PX} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      ))}
    </div>
  )
}
