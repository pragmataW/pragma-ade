import { flushSync } from 'react-dom'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

type TransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown }

/**
 * Runs a shell layout change (pane moved, swapped, collapsed, maximized) as a view transition, so panes glide to
 * their new place instead of jumping. Without the API, or with reduced motion, it just applies the change.
 */
export function animateLayout(update: () => void): void {
  const doc = document as TransitionDocument
  if (!doc.startViewTransition || window.matchMedia?.(REDUCED_MOTION).matches) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}
