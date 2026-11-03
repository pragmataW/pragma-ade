import type { CustomItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { COMPACT_NOTICE_TESTID } from './constants'
import { type ChatPartProps, formatCount } from './kit'

/** `custom:claude.compact-boundary`: a thin divider "Conversation compacted (N tokens summarized)". */
export function CompactBoundaryNotice({ item }: ChatPartProps<CustomItem>) {
  const t = useT()
  const preTokens = (item.data as { preTokens?: number } | null)?.preTokens ?? 0
  return (
    <div data-testid={COMPACT_NOTICE_TESTID} className="flex items-center gap-3 text-[11.5px] text-mu">
      <span className="h-px flex-1 bg-bd" />
      {t('claude:chat.compacted', { tokens: formatCount(preTokens) })}
      <span className="h-px flex-1 bg-bd" />
    </div>
  )
}
