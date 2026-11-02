import { useT } from '@pragma/sdk/renderer'
import { TriangleAlert } from '@pragma/ui/icons'
import { I18N_KEY_RE, ICON_PX, ICON_STROKE } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, type ErrorItem, UNSUPPORTED_PREFIX } from '../../../contract'
import { CollapsibleCard } from './lib/CollapsibleCard'
import { MonoPre } from './lib/MonoPre'

/**
 * `chat:unsupported.*` reasons become "Chat mode not supported: <reason>"; a message that is an i18n key (11c start
 * guard) is translated; other messages are shown as is.
 */
export function useErrorText(message: string): string {
  const t = useT()
  if (message.startsWith(UNSUPPORTED_PREFIX)) return t('chat:errors.unsupported', { reason: t(message) })
  return I18N_KEY_RE.test(message) ? t(message) : message
}

/** An error (err icon); the detail (e.g. the CLI's stderr tail) is collapsible. */
export function ErrorRow({ item }: ChatPartProps<ErrorItem>) {
  const text = useErrorText(item.message)
  const title = (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-err">
      <TriangleAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </span>
  )
  if (!item.detail)
    return (
      <div
        data-testid={CHAT_TESTIDS.errorRow}
        className="flex h-8 items-center rounded-lg border border-err/40 px-2.5 text-[12.5px]"
      >
        {title}
      </div>
    )
  return (
    <CollapsibleCard testId={CHAT_TESTIDS.errorRow} className="border-err/40 bg-transparent" header={title}>
      <MonoPre className="text-mu">{item.detail}</MonoPre>
    </CollapsibleCard>
  )
}
