import { useT } from '@pragma/sdk/renderer'
import { CodeBlock } from '@pragma/ui/components/code-block'
import { CopyButton } from '@pragma/ui/components/copy-button'
import { Markdown } from '@pragma/ui/components/markdown'
import { PLAIN_LANG } from '@pragma/ui/constants/ui'
import { useMemo, useRef } from 'react'
import { CODE_SEGMENT } from '../../../constants'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type TextItem } from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { splitFences } from '../../lib/markdown-segments'
import { MessageCopy } from './lib/MessageCopy'
import { useFileLinks } from './lib/use-file-links'
import { useInlineFileRefs } from './lib/use-inline-file-refs'

const safeDecode = (href: string): string => {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

/** One fenced block with its own copy button (exact code). */
function CopyableCode({ code, lang }: { code: string; lang: string }) {
  const t = useT()
  return (
    <div className="pragma-markdown group/code relative">
      <CodeBlock code={code} lang={lang || PLAIN_LANG} />
      <div data-testid={CHAT_TESTIDS.copyCode} className="absolute top-1 right-1">
        <CopyButton
          text={code}
          label={t('chat:copy.code')}
          copiedLabel={t('chat:copy.copied')}
          className="size-6 bg-el"
        />
      </div>
    </div>
  )
}

/** Assistant prose (safe Markdown, shared highlighter); a caret while streaming; file references open the editor. */
export function AssistantText({ item, session }: ChatPartProps<TextItem>) {
  const host = useChatHost()
  const segments = useMemo(() => splitFences(item.text), [item.text])
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
      className="text-[13px] leading-[1.6] text-tx"
      onClick={refs.onClick}
      onKeyDown={refs.onKeyDown}
    >
      {segments.map((s, i) =>
        s.kind === CODE_SEGMENT ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional parts of one message
          <CopyableCode key={i} code={s.code} lang={s.lang} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional parts of one message
          <Markdown key={i} source={s.text} onLinkClick={onLinkClick} />
        ),
      )}
      {item.streaming ? (
        <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-mu align-middle" />
      ) : (
        <MessageCopy text={item.text} />
      )}
    </div>
  )
}
