import { type ElectronInputLike, matchShortcut } from '@pragma/sdk'
import { KEY_DOWN, SHORTCUTS } from '../constants'

export type ShortcutAction = keyof typeof SHORTCUTS
const ACTIONS = Object.keys(SHORTCUTS) as ShortcutAction[]

/** The browser action for a key typed inside a guest page (`before-input-event`), key-down only. */
export function resolveShortcut(input: ElectronInputLike & { type: string }, platform: string): ShortcutAction | null {
  if (input.type !== KEY_DOWN) return null
  return ACTIONS.find((a) => SHORTCUTS[a].some((acc) => matchShortcut(input, acc, platform))) ?? null
}
