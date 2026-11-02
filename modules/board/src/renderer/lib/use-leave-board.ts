import { useRendererHost } from '@pragma/sdk/renderer'
import { useEffect } from 'react'
import { ESCAPE_KEY, KEYDOWN_EVENT } from '../../constants'
import { runAction } from './actions'
import { leaveBoard } from './navigation'
import { viewHistory } from './view-history'

/** Starts watching the shell's center views (idempotent), so Back knows where the board was opened from. */
export function useTrackViews(): void {
  const { registries } = useRendererHost()
  useEffect(() => viewHistory.track(registries.store), [registries])
}

/** Fields keep their own Esc (cancel an edit, close a picker). */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
/** An open drawer, dialog, menu or list closes on Esc first. */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** A plain Esc nobody else handled: not in a field, not over an open overlay, no modifiers. */
export function isLeaveEscape(e: KeyboardEvent, doc: Document): boolean {
  if (e.key !== ESCAPE_KEY || e.defaultPrevented || e.repeat) return false
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
  if (e.target instanceof Element && e.target.closest(EDITABLE)) return false
  return doc.querySelector(OVERLAY) === null
}

/**
 * While the board is mounted, an unhandled Esc leaves it like Back. A bubble-phase document listener: Radix
 * overlays (capture phase) and fields see the key first, and the overlay is still in the DOM while it closes.
 */
export function useEscapeLeavesBoard(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLeaveEscape(e, document)) runAction(leaveBoard())
    }
    document.addEventListener(KEYDOWN_EVENT, onKeyDown)
    return () => document.removeEventListener(KEYDOWN_EVENT, onKeyDown)
  }, [])
}
