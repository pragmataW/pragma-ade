export const KEY_ACTIONS = ['nextFile', 'prevFile', 'nextChange', 'prevChange', 'find', 'filter'] as const
export type KeyAction = (typeof KEY_ACTIONS)[number]
export const [NEXT_FILE, PREV_FILE, NEXT_CHANGE, PREV_CHANGE, FIND, FILTER] = KEY_ACTIONS

export interface PanelKey {
  key: string
  /** The physical key (`KeyF`): ⌥⌘F types `ƒ` on macOS. */
  code: string
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
const FIND_CODE = 'KeyF'

const isMod = (e: PanelKey): boolean => (e.metaKey || e.ctrlKey) && !e.shiftKey

/** Cmd/Ctrl+F (also while typing): find in the open diff. */
const isFind = (e: PanelKey): boolean => isMod(e) && !e.altKey && e.key.toLowerCase() === FIND_KEY

/** Cmd/Ctrl+Alt+F (also while typing; VS Code's tree filter chord): filter the changed files. */
const isFilter = (e: PanelKey): boolean =>
  isMod(e) && e.altKey && (e.code === FIND_CODE || e.key.toLowerCase() === FIND_KEY)

/** Panel shortcuts (j / k / n / Shift+N, Cmd/Ctrl+F, Cmd/Ctrl+Alt+F); the letters not while typing or with a modifier. */
export function keyToAction(e: PanelKey): KeyAction | null {
  if (isFind(e)) return FIND
  if (isFilter(e)) return FILTER
  if (e.altKey || e.metaKey || e.ctrlKey || e.targetIsEditable) return null
  return (e.shiftKey ? SHIFTED : PLAIN).get(e.key) ?? null
}
