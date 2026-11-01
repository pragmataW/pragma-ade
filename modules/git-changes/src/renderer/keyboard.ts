export const KEY_ACTIONS = ['nextFile', 'prevFile', 'nextChange', 'prevChange'] as const
export type KeyAction = (typeof KEY_ACTIONS)[number]
const [NEXT_FILE, PREV_FILE, NEXT_CHANGE, PREV_CHANGE] = KEY_ACTIONS

export interface PanelKey {
  key: string
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  /** The event comes from an input, textarea or contenteditable (the comment composer). */
  targetIsEditable: boolean
}

/** Unshifted keys → actions; `Shift+N` is the only shifted one. */
const PLAIN = new Map<string, KeyAction>([
  ['j', NEXT_FILE],
  ['k', PREV_FILE],
  ['n', NEXT_CHANGE],
])
const SHIFTED = new Map<string, KeyAction>([['N', PREV_CHANGE]])

/** Panel shortcuts (j / k / n / Shift+N); none while typing or with alt/meta/ctrl. */
export function keyToAction(e: PanelKey): KeyAction | null {
  if (e.altKey || e.metaKey || e.ctrlKey || e.targetIsEditable) return null
  return (e.shiftKey ? SHIFTED : PLAIN).get(e.key) ?? null
}
