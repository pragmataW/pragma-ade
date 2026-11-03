import { useEffect, useState } from 'react'
import { ELAPSED_TICK_MS } from '../../../../constants'

/** `Date.now()`, re-rendering every second while `active` (live elapsed times). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}
