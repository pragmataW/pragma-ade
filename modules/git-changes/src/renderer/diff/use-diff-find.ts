import { type RefObject, useCallback, useEffect, useState } from 'react'
import { FIND_HIGHLIGHT, FIND_REFIND_DELAY_MS, FIND_SCROLL_MARGIN_PX } from '../../constants'
import { byPosition, findInDiff, wrapIndex } from './find'

const DIFFS_CONTAINER = 'diffs-container'

/** The highlight registry (absent in jsdom): every match, and the current one on top. */
type HighlightRegistry = Map<string, unknown>
const registry = (): HighlightRegistry | undefined =>
  (globalThis.CSS as { highlights?: HighlightRegistry } | undefined)?.highlights
const HighlightCtor = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight

function paint(matches: Range[], current: Range | undefined): void {
  const highlights = registry()
  if (!highlights || !HighlightCtor) return
  highlights.set(FIND_HIGHLIGHT.all, new HighlightCtor(...matches))
  if (current) highlights.set(FIND_HIGHLIGHT.current, new HighlightCtor(current))
  else highlights.delete(FIND_HIGHLIGHT.current)
}

function clearPaint(): void {
  registry()?.delete(FIND_HIGHLIGHT.all)
  registry()?.delete(FIND_HIGHLIGHT.current)
}

/** Scrolls `scroller` so the match sits in view, with some context above it. */
function reveal(scroller: HTMLElement, range: Range): void {
  const box = range.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  if (box.top >= view.top + FIND_SCROLL_MARGIN_PX && box.bottom <= view.bottom - FIND_SCROLL_MARGIN_PX) return
  scroller.scrollTo({ top: scroller.scrollTop + box.top - view.top - FIND_SCROLL_MARGIN_PX })
}

export interface DiffFind {
  open: boolean
  query: string
  count: number
  /** 0-based; meaningless while `count` is 0. */
  index: number
  show(): void
  hide(): void
  setQuery(q: string): void
  step(direction: 1 | -1): void
}

/**
 * Cmd/Ctrl+F inside the open diff: matches of the query in the rendered code (re-found when the diff re-renders, e.g.
 * a collapsed region expands), highlighted with the CSS Custom Highlight API, the current one scrolled into view.
 */
export function useDiffFind(scroller: RefObject<HTMLElement | null>, contentKey: string): DiffFind {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Range[]>([])
  const [index, setIndex] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: contentKey: another file or its contents arriving re-finds
  useEffect(() => {
    const host = scroller.current?.querySelector(DIFFS_CONTAINER)
    const root = host?.shadowRoot
    if (!open || !root) {
      setMatches([])
      return
    }
    // The diff re-renders its rows after the first paint (syntax tokens, expanded regions), which collapses the
    // ranges found so far: find again once the rows settle. A timer, not rAF, which hidden windows never run.
    let timer: ReturnType<typeof setTimeout> | undefined
    const refind = () => setMatches(byPosition(findInDiff(root, query)))
    refind()
    const observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(refind, FIND_REFIND_DELAY_MS)
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [scroller, open, query, contentKey])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new query or file starts again at the first match
  useEffect(() => setIndex(0), [query, contentKey])

  const current = matches[Math.min(index, matches.length - 1)]
  useEffect(() => {
    if (!open) return clearPaint()
    paint(matches, current)
    if (current && scroller.current) reveal(scroller.current, current)
  }, [open, matches, current, scroller])
  useEffect(() => clearPaint, [])

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  const step = useCallback((d: 1 | -1) => setIndex((i) => wrapIndex(i, d, matches.length)), [matches.length])
  return {
    open,
    query,
    count: matches.length,
    index: Math.min(index, Math.max(matches.length - 1, 0)),
    show,
    hide,
    setQuery,
    step,
  }
}
