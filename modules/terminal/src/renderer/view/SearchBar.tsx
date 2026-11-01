import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import type { ISearchOptions, SearchAddon } from '@xterm/addon-search'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { TerminalTestIds } from '../../contract'
import { getRuntime } from '../runtime'

const ENTER = 'Enter'
const ESCAPE = 'Escape'
const ICON_PX = 14

/** Match highlighting from the theme (decorations are also what makes the addon report result counts). */
function useSearchOptions(): ISearchOptions {
  const { tokens } = getRuntime().theme.get()
  return useMemo(
    () => ({
      incremental: true,
      decorations: {
        matchBackground: tokens.acs,
        activeMatchBackground: tokens.ac,
        matchOverviewRuler: tokens.acs ?? '',
        activeMatchColorOverviewRuler: tokens.ac ?? '',
      },
    }),
    [tokens],
  )
}

function useResults(search: SearchAddon): { current: number; total: number } {
  const [results, setResults] = useState({ current: 0, total: 0 })
  useEffect(() => {
    const sub = search.onDidChangeResults(({ resultIndex, resultCount }) =>
      setResults({ current: resultIndex + 1, total: resultCount }),
    )
    return () => sub.dispose()
  }, [search])
  return results
}

function BarButton({ icon, label, onClick }: { icon: string; label: string; onClick(): void }) {
  return (
    <Button size="icon-sm" variant="ghost" aria-label={label} onClick={onClick}>
      <Icon name={icon} size={ICON_PX} />
    </Button>
  )
}

/** Find bar over a terminal: Enter next, Shift+Enter previous, Esc closes and refocuses the terminal. */
export function SearchBar({ search, onClose }: { search: SearchAddon; onClose(): void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const options = useSearchOptions()
  const { current, total } = useResults(search)
  const next = (q = query) => q && search.findNext(q, options)
  const previous = () => query && search.findPrevious(query, options)
  const close = () => {
    search.clearDecorations()
    onClose()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ESCAPE) close()
    if (e.key !== ENTER) return
    if (e.shiftKey) previous()
    else next()
  }
  return (
    <div
      data-testid={TerminalTestIds.searchBar}
      className="absolute top-2 right-3 z-10 flex items-center gap-1 rounded-[var(--radius-button)] border border-bd bg-el p-1 shadow-md"
    >
      <Input
        data-testid={TerminalTestIds.searchInput}
        autoFocus
        value={query}
        placeholder={t('terminal:search.placeholder')}
        className="h-7 w-44 text-[12px]"
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value) next(e.target.value)
          else search.clearDecorations()
        }}
        onKeyDown={onKeyDown}
      />
      <span data-testid={TerminalTestIds.searchResults} className="min-w-16 px-1 text-[11px] text-mu">
        {query && (total > 0 ? t('terminal:search.results', { current, total }) : t('terminal:search.noResults'))}
      </span>
      <BarButton icon="chevron-up" label={t('terminal:search.previous')} onClick={previous} />
      <BarButton icon="chevron-down" label={t('terminal:search.next')} onClick={() => next()} />
      <BarButton icon="x" label={t('terminal:search.close')} onClick={close} />
    </div>
  )
}
