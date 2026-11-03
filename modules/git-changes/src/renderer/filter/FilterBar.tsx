import { useT } from '@pragma/sdk/renderer'
import { cn, EmptyState } from '@pragma/ui'
import { Search, X } from '@pragma/ui/icons'
import type { KeyboardEvent, Ref } from 'react'
import { BUTTON_TYPE, EMPTY_ICONS, FILTER_ICON_PX } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import type { FileFilter } from './filter-files'

const ENTER = 'Enter'
const ESCAPE = 'Escape'
const FIND_KEY = 'f'
const NO_MATCHES_KIND = 'noMatches'

export interface FilterBarProps {
  value: string
  filter: FileFilter
  onChange(value: string): void
  /** Enter: select the best match. */
  onSubmit(): void
  inputRef: Ref<HTMLInputElement>
}

/**
 * The changed-files filter above the list: search icon, query (filters on every keystroke), "n of m" while it filters,
 * a clear button. Escape clears the query, a second Escape leaves the field; Cmd/Ctrl+F selects the query.
 */
export function FilterBar({ value, filter, onChange, onSubmit, inputRef }: FilterBarProps) {
  const t = useT()
  const none = filter.active && filter.visible.length === 0
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    if (e.key === ENTER) onSubmit()
    else if (e.key === ESCAPE) {
      if (value === '') input.blur()
      else onChange('')
    } else if (e.key.toLowerCase() === FIND_KEY && (e.metaKey || e.ctrlKey)) input.select()
    else return
    e.preventDefault()
    e.stopPropagation()
  }
  return (
    <div
      data-testid={T.filterBar}
      className="flex h-8 shrink-0 items-center border-[var(--bd)] border-b bg-[var(--pn)] px-1.5"
    >
      <div
        className={cn(
          'flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md border bg-[var(--bg)] pr-0.5 pl-1.5',
          none ? 'border-[var(--err)]' : 'border-[var(--bd2)] focus-within:border-[var(--ac)]',
        )}
      >
        <Search size={FILTER_ICON_PX} className="shrink-0 text-[var(--fa)]" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          data-testid={T.filterInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('git-changes:filter.placeholder')}
          aria-label={t('git-changes:filter.label')}
          title={t('git-changes:filter.label')}
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[var(--tx)] outline-none placeholder:text-[var(--fa)] [&::-webkit-search-cancel-button]:hidden"
        />
        {filter.active ? (
          <span
            data-testid={T.filterCount}
            aria-live="polite"
            className={cn('shrink-0 text-[11px] tabular-nums', none ? 'text-[var(--err)]' : 'text-muted-foreground')}
          >
            {t('git-changes:filter.count', { count: filter.visible.length, total: filter.total })}
          </span>
        ) : null}
        {value === '' ? null : (
          <button
            type={BUTTON_TYPE}
            data-testid={T.filterClear}
            aria-label={t('git-changes:filter.clear')}
            title={t('git-changes:filter.clear')}
            // Keeps the focus in the field.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange('')}
            className="flex size-[18px] shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[var(--hv)] hover:text-[var(--tx)]"
          >
            <X size={FILTER_ICON_PX} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/** The list's empty state while nothing matches: the query and a way back. */
export function NoMatches({ query, onReset }: { query: string; onReset(): void }) {
  const t = useT()
  return (
    <EmptyState
      testId={T.empty}
      data-kind={NO_MATCHES_KIND}
      icon={EMPTY_ICONS.noMatches}
      title={<span className="break-words">{t('git-changes:empty.noMatches', { query: query.trim() })}</span>}
      description={t('git-changes:empty.noMatchesHint')}
      secondaryAction={{ label: t('git-changes:filter.reset'), onClick: onReset, testId: T.filterReset }}
    />
  )
}
