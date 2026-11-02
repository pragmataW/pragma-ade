import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { ChevronDown, ChevronUp, X } from '@pragma/ui/icons'
import { type KeyboardEvent, type Ref, type RefObject, useEffect, useImperativeHandle, useRef } from 'react'
import { BUTTON_TYPE, DIFF_ICON_PX } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { useDiffFind } from './use-diff-find'

const ENTER = 'Enter'
const ESCAPE = 'Escape'
const FIND_KEY = 'f'

function BarButton(props: { label: string; testId: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type={BUTTON_TYPE}
      data-testid={props.testId}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[var(--hv)] hover:text-[var(--tx)]"
    >
      {props.children}
    </button>
  )
}

export interface FindBarHandle {
  show(): void
}

/**
 * Find in the open diff: query, "n of m", previous / next (Shift+Enter / Enter), close (Esc). It owns the find state,
 * so typing and stepping never re-render the diff (a re-render rewrites its rows and drops the highlights).
 */
export function FindBar(props: {
  scroller: RefObject<HTMLElement | null>
  contentKey: string
  ref?: Ref<FindBarHandle>
}) {
  const t = useT()
  const find = useDiffFind(props.scroller, props.contentKey)
  useImperativeHandle(props.ref, () => ({ show: find.show }), [find.show])
  const input = useRef<HTMLInputElement>(null)
  // Cmd/Ctrl+F again while open selects the query for a new search.
  useEffect(() => {
    if (find.open) input.current?.select()
  }, [find.open])
  if (!find.open) return null
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === ENTER) {
      e.preventDefault()
      find.step(e.shiftKey ? -1 : 1)
    } else if (e.key === ESCAPE) find.hide()
    else if (e.key.toLowerCase() === FIND_KEY && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      input.current?.select()
    }
  }
  const none = find.query !== '' && find.count === 0
  return (
    <div
      data-testid={T.findBar}
      className="flex h-8 shrink-0 items-center gap-1 border-[var(--bd)] border-b bg-[var(--pn)] px-2"
    >
      <input
        ref={input}
        autoFocus
        data-testid={T.findInput}
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('git-changes:find.placeholder')}
        aria-label={t('git-changes:find.placeholder')}
        className={cn(
          'h-6 min-w-0 flex-1 rounded-md border bg-[var(--bg)] px-2 text-[12px] outline-none focus:border-[var(--ac)]',
          none ? 'border-[var(--err)]' : 'border-[var(--bd2)]',
        )}
      />
      <span
        data-testid={T.findCount}
        className="min-w-[56px] shrink-0 text-center text-[11px] text-muted-foreground tabular-nums"
      >
        {find.query === ''
          ? ''
          : none
            ? t('git-changes:find.none')
            : t('git-changes:find.count', { current: find.index + 1, total: find.count })}
      </span>
      <BarButton label={t('git-changes:find.prev')} testId={T.findPrev} onClick={() => find.step(-1)}>
        <ChevronUp size={DIFF_ICON_PX} aria-hidden />
      </BarButton>
      <BarButton label={t('git-changes:find.next')} testId={T.findNext} onClick={() => find.step(1)}>
        <ChevronDown size={DIFF_ICON_PX} aria-hidden />
      </BarButton>
      <BarButton label={t('git-changes:find.close')} testId={T.findClose} onClick={find.hide}>
        <X size={DIFF_ICON_PX} aria-hidden />
      </BarButton>
    </div>
  )
}
