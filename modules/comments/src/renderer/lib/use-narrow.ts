import { type RefCallback, useCallback, useLayoutEffect, useState } from 'react'

/**
 * Whether the element is narrower than `px` (ResizeObserver). Unmeasured (no observer, or a width of 0 as in jsdom)
 * counts as wide.
 */
export function useNarrow<E extends HTMLElement>(px: number): [RefCallback<E>, boolean] {
  const [el, setEl] = useState<E | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  const ref = useCallback((node: E | null) => setEl(node), [])
  return [ref, width > 0 && width < px]
}
