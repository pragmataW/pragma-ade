import { useT } from '@pragma/sdk/renderer'
import { Brain } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type ThinkingItem } from '../../../contract'
import { CollapsibleCard } from './lib/CollapsibleCard'

/** The model's thinking: collapsed by default, muted when expanded. */
export function ThinkingBlock({ item }: ChatPartProps<ThinkingItem>) {
  const t = useT()
  return (
    <CollapsibleCard
      testId={CHAT_TESTIDS.part(EVENT_KIND.thinking)}
      className="border-transparent bg-transparent"
      header={
        <span className="flex items-center gap-1.5 text-mu">
          <Brain size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          {t('chat:thinking.label')}
        </span>
      }
    >
      <div className="whitespace-pre-wrap text-[12.5px] leading-[1.6] text-mu">{item.text}</div>
    </CollapsibleCard>
  )
}
