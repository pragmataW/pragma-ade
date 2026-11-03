import { type RefObject, useEffect } from 'react'
import { FOCUS_FLASH_CLASS, FOCUS_FLASH_MS, FOCUS_RETRY_MS, FOCUS_TIMEOUT_MS } from '../../constants'
import { type RevealFocus, useGitChangesStore, viewOf } from '../store'

const DIFFS_CONTAINER = 'diffs-container'
const DELETION_TYPE = 'change-deletion'
const OLD_SIDE = 'old'
const CENTER = 'center'

/** A row of the diff (inside its shadow root) showing `line` on `side`: deletions are old-side rows. */
function findLine(scroller: HTMLElement, line: number, side: RevealFocus['side']): HTMLElement | null {
  const root = scroller.querySelector(DIFFS_CONTAINER)?.shadowRoot
  if (!root) return null
  const rows = [...root.querySelectorAll<HTMLElement>(`[data-line="${line}"]`)]
  const old = side === OLD_SIDE
  return rows.find((r) => (r.getAttribute('data-line-type') === DELETION_TYPE) === old) ?? rows[0] ?? null
}

/** The thread card (slotted, light DOM) or else the line row the focus names. */
export function findFocusTarget(scroller: HTMLElement, focus: RevealFocus): HTMLElement | null {
  const card = focus.commentId
    ? scroller.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(focus.commentId)}"]`)
    : null
  if (card) return card
  return focus.line === undefined ? null : findLine(scroller, focus.line, focus.side)
}

function flash(el: HTMLElement): void {
  el.scrollIntoView({ block: CENTER })
  el.classList.add(FOCUS_FLASH_CLASS)
  setTimeout(() => el.classList.remove(FOCUS_FLASH_CLASS), FOCUS_FLASH_MS)
}

/**
 * Brings `gitChanges.reveal`'s focus into view once the diff is `ready`: retries until the diff has rendered the
 * target (or FOCUS_TIMEOUT_MS passed), scrolls it to the middle, flashes it and clears the focus.
 */
export function useRevealFocus(worktreeId: string, scroller: RefObject<HTMLElement | null>, ready: boolean): void {
  const focus = useGitChangesStore((s) => viewOf(s, worktreeId).focus)
  useEffect(() => {
    if (!focus || !ready) return undefined
    const clear = () => useGitChangesStore.getState().clearFocus(worktreeId)
    const deadline = Date.now() + FOCUS_TIMEOUT_MS
    const attempt = (): boolean => {
      const target = scroller.current ? findFocusTarget(scroller.current, focus) : null
      if (target) flash(target)
      if (!target && Date.now() < deadline) return false
      clear()
      return true
    }
    if (attempt()) return undefined
    const timer = setInterval(() => {
      if (attempt()) clearInterval(timer)
    }, FOCUS_RETRY_MS)
    return () => clearInterval(timer)
  }, [focus, ready, worktreeId, scroller])
}
