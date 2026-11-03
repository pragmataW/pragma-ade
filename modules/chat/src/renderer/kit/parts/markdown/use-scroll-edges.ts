import { type RefObject, useCallback, useEffect, useState } from 'react'
import { SCROLL_EDGE_SLACK_PX } from '../../../../constants'

export interface ScrollEdges {
  /** Content is hidden past the left edge. */
  start: boolean
  /** Content is hidden past the right edge. */
  end: boolean
}

const NONE: ScrollEdges = { start: false, end: false }

const edgesOf = (el: HTMLElement): ScrollEdges => ({
  start: el.scrollLeft > SCROLL_EDGE_SLACK_PX,
  end: el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_EDGE_SLACK_PX,
})

/** Which sides of a horizontally scrolling box hide content (for fade shadows); updates on scroll and resize. */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): { edges: ScrollEdges; onScroll(): void } {
  const [edges, setEdges] = useState<ScrollEdges>(NONE)
  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const next = edgesOf(el)
    setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
  }, [ref])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [ref, update])
  return { edges, onScroll: update }
}
