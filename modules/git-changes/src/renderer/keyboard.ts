export const KEY_ACTIONS = ['nextFile', 'prevFile', 'nextChange', 'prevChange', 'find'] as const
export type KeyAction = (typeof KEY_ACTIONS)[number]
export const [NEXT_FILE, PREV_FILE, NEXT_CHANGE, PREV_CHANGE, FIND] = KEY_ACTIONS

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

const FIND_KEY = 'f'

/** Cmd/Ctrl+F (also while typing): find in the open diff. */
const isFind = (e: PanelKey): boolean =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === FIND_KEY

/** Panel shortcuts (j / k / n / Shift+N, Cmd/Ctrl+F); the letters not while typing or with alt/meta/ctrl. */
export function keyToAction(e: PanelKey): KeyAction | null {
  if (isFind(e)) return FIND
  if (e.altKey || e.metaKey || e.ctrlKey || e.targetIsEditable) return null
  return (e.shiftKey ? SHIFTED : PLAIN).get(e.key) ?? null
}
