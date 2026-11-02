import { Markdown } from '@pragma/ui/components/markdown'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type TextItem } from '../../../contract'
import { useChatHost } from '../../host-adapter'

/** Assistant prose (safe Markdown, shared highlighter); a caret while streaming. */
export function AssistantText({ item }: ChatPartProps<TextItem>) {
  const host = useChatHost()
  return (
    <div
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.textDelta)}
      {...{ [CHAT_DATA_ATTRS.streaming]: item.streaming }}
      className="text-[13px] leading-[1.6] text-tx"
    >
      <Markdown source={item.text} onLinkClick={(href) => host.openExternal(href)} />
      {item.streaming ? (
        <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-mu align-middle" />
      ) : null}
    </div>
  )
}
