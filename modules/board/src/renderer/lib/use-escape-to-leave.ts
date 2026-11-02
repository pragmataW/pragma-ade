import { useEffect } from 'react'
import { ESCAPE_KEY, KEYDOWN_EVENT } from '../../constants'

/** Esc in these belongs to the field (cancel an edit, xterm's helper textarea, …). */
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
/** An open drawer, dialog, menu or select list takes Esc first (Radix also marks it handled). */
const OPEN_OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** True when a plain Esc that nobody handled should leave the board. */
export function isLeaveEscape(e: KeyboardEvent, doc: Document): boolean {
  if (e.key !== ESCAPE_KEY || e.defaultPrevented || e.repeat) return false
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
  if (e.target instanceof Element && e.target.closest(EDITABLE_SELECTOR)) return false
  return doc.querySelector(OPEN_OVERLAY_SELECTOR) === null
}

/**
 * While mounted, an unhandled Esc calls `leave`. A bubble-phase document listener, so Radix (capture phase, calls
 * `preventDefault` when it closes the drawer or a menu) and field handlers win.
 */
export function useEscapeToLeave(leave: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLeaveEscape(e, document)) leave()
    }
    document.addEventListener(KEYDOWN_EVENT, onKeyDown)
    return () => document.removeEventListener(KEYDOWN_EVENT, onKeyDown)
  }, [leave])
}
