import { useRef } from 'react'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type TextItem } from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { MessageCopy } from './lib/MessageCopy'
import { useFileLinks } from './lib/use-file-links'
import { useInlineFileRefs } from './lib/use-inline-file-refs'
import { RichMarkdown } from './markdown/RichMarkdown'

const safeDecode = (href: string): string => {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

/** Assistant prose (safe Markdown, shared highlighter); a caret while streaming; file references open the editor. */
export function AssistantText({ item, session }: ChatPartProps<TextItem>) {
  const host = useChatHost()
  const links = useFileLinks(session)
  const root = useRef<HTMLDivElement>(null)
  const refs = useInlineFileRefs(root, item.text, links)
  const onLinkClick = (href: string) => {
    const ref = links.refOf(safeDecode(href))
    if (ref) links.open(ref)
    else host.openExternal(href)
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegates clicks of the decorated inline file links
    <div
      ref={root}
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.textDelta)}
      {...{ [CHAT_DATA_ATTRS.streaming]: item.streaming }}
      className="group/msg text-[13px] leading-[1.6] text-tx"
      onClick={refs.onClick}
      onKeyDown={refs.onKeyDown}
    >
      <RichMarkdown text={item.text} streaming={item.streaming} onLinkClick={onLinkClick} />
      {/* one fixed-height row for the caret, then the copy button: the message does not grow when streaming ends */}
      <div className="flex h-6 items-center">
        {item.streaming ? (
          <span
            aria-hidden
            className="inline-block h-3.5 w-1.5 animate-pulse rounded-[1px] bg-mu motion-reduce:animate-none"
          />
        ) : (
          <MessageCopy
            text={item.text}
            className="-ml-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100 motion-reduce:transition-none"
          />
        )}
      </div>
    </div>
  )
}
