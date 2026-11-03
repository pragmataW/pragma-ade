import { type RefObject, useEffect, useRef, useState } from 'react'

/** The element's last observed width; null until a ResizeObserver reports one (jsdom, first paint). */
export function useBarWidth<E extends HTMLElement>(): [RefObject<E | null>, number | null] {
  const ref = useRef<E>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const target = ref.current
    if (!target || !globalThis.ResizeObserver) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry ? entry.contentRect.width || null : null))
    observer.observe(target)
    return () => observer.disconnect()
  })
  return [ref, width]
}
