import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ChevronDown, ChevronUp, Search, X } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, SIZE_ICON_XS, VARIANT_GHOST } from '../../constants'
import { CHAT_TESTIDS } from '../../contract'
import type { ChatSearch } from '../hooks/use-chat-search'

/** Tokens `acs` (every hit) and `ac`/`acfg` (the current one) for the CSS Custom Highlight API. */
const HIGHLIGHT_CSS =
  '::highlight(chat-search){background-color:var(--acs)}::highlight(chat-search-current){background-color:var(--ac);color:var(--acfg)}'

/** The find bar over the message list (Mod+F). */
export function ChatSearchBar({ search }: { search: ChatSearch }) {
  const t = useT()
  if (!search.open) return null
  const total = search.matches.length
  const count = search.query
    ? total > 0
      ? t('chat:search.count', { current: search.current + 1, total })
      : t('chat:search.none')
    : ''
  const nav = [
    { label: t('chat:search.previous'), Icon: ChevronUp, run: search.previous, testId: CHAT_TESTIDS.searchPrevious },
    { label: t('chat:search.next'), Icon: ChevronDown, run: search.next, testId: CHAT_TESTIDS.searchNext },
    { label: t('chat:search.close'), Icon: X, run: search.close, testId: CHAT_TESTIDS.searchClose },
  ]
  return (
    <div
      data-testid={CHAT_TESTIDS.searchBar}
      className="absolute top-2 right-4 z-20 flex h-8 items-center gap-1 rounded-md border border-bd bg-el px-2 shadow-lg"
    >
      <style>{HIGHLIGHT_CSS}</style>
      <Search size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="text-mu" />
      <input
        ref={search.input}
        data-testid={CHAT_TESTIDS.searchInput}
        value={search.query}
        placeholder={t('chat:search.placeholder')}
        aria-label={t('chat:search.placeholder')}
        onChange={(e) => search.setQuery(e.target.value)}
        onKeyDown={search.onInputKeyDown}
        className="w-44 bg-transparent text-[12.5px] text-tx outline-none placeholder:text-fa"
      />
      <span data-testid={CHAT_TESTIDS.searchCount} className="min-w-14 text-right text-[11.5px] text-mu">
        {count}
      </span>
      {nav.map(({ label, Icon, run, testId }) => (
        <Button
          key={testId}
          variant={VARIANT_GHOST}
          size={SIZE_ICON_XS}
          aria-label={label}
          title={label}
          data-testid={testId}
          onClick={run}
        >
          <Icon size={ICON_PX} strokeWidth={ICON_STROKE} />
        </Button>
      ))}
    </div>
  )
}
