import type { CustomItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { RefreshCw } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, OPENCODE_CHAT_TESTIDS, RETRY_TITLE_KEY } from './constants'
import type { ChatPartProps } from './kit'
import { retryPayloadSchema } from './payloads'

/** `custom:opencode.retry`: "Retrying (attempt N)" + the provider's message, in the warn colour. */
export function RetryNotice({ item }: ChatPartProps<CustomItem>) {
  const t = useT()
  const retry = retryPayloadSchema.safeParse(item.data)
  if (!retry.success) return null
  return (
    <div data-testid={OPENCODE_CHAT_TESTIDS.retry} className="flex items-center gap-2 text-[12px] text-warn">
      <RefreshCw size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" />
      <span className="font-medium">{t(RETRY_TITLE_KEY, { attempt: retry.data.attempt })}</span>
      <span className="min-w-0 truncate text-mu">{retry.data.message}</span>
    </div>
  )
}
