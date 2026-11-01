import type { Rect } from '@pragma/sdk'
import { type RefObject, useEffect } from 'react'

const RESIZE = 'resize'

const toRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
}

const same = (a: Rect | null, b: Rect | null): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)

/** Reports the element's viewport rect while `enabled` (null otherwise); syncs with ResizeObserver + window resize. */
export function useElementBounds(ref: RefObject<Element | null>, enabled: boolean, onBounds: (r: Rect | null) => void) {
  useEffect(() => {
    const el = ref.current
    let last: Rect | null | undefined
    const report = (next: Rect | null): void => {
      if (last !== undefined && same(last, next)) return
      last = next
      onBounds(next)
    }
    if (!enabled || !el) {
      report(null)
      return
    }
    const measure = (): void => report(toRect(el))
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener(RESIZE, measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener(RESIZE, measure)
    }
  }, [ref, enabled, onBounds])
}
