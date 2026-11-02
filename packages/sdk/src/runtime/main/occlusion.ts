import { type OverlayGuardMode, SNAPSHOT_GUARD_MODE } from '@pragma/ui/constants/overlay'
import type { OverlayCover } from '../../common/core-ipc'
import type { Rect } from '../../common/shell'
import { SNAPSHOT_CAPTURE_TIMEOUT_MS } from '../../constants'

/** True when the two rects share a non-empty area (touching edges do not count). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The strongest mode among the overlays over `bounds` ('snapshot' beats 'hide'), or null when none is. */
export function coverModeFor(covers: readonly OverlayCover[], bounds: Rect): OverlayGuardMode | null {
  let mode: OverlayGuardMode | null = null
  for (const c of covers) {
    if (c.rect !== null && !rectsIntersect(bounds, c.rect)) continue
    if (c.mode === SNAPSHOT_GUARD_MODE) return c.mode
    mode = c.mode
  }
  return mode
}

/** Resolves with the promise's value, or `null` when it rejects or takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** The page capture for a cover: 'snapshot' waits for it; 'hide' gives up after a short timeout (null = no image). */
export function captureFor(mode: OverlayGuardMode, shot: Promise<string>): Promise<string | null> {
  return mode === SNAPSHOT_GUARD_MODE ? shot.catch(() => null) : withTimeout(shot, SNAPSHOT_CAPTURE_TIMEOUT_MS)
}
