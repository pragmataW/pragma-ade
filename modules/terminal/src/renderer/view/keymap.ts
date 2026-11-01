export const TERMINAL_KEY_ACTION = { copy: 'copy', paste: 'paste', search: 'search' } as const
export const TERMINAL_KEY_ACTIONS = [
  TERMINAL_KEY_ACTION.copy,
  TERMINAL_KEY_ACTION.paste,
  TERMINAL_KEY_ACTION.search,
] as const
export type TerminalKeyAction = (typeof TERMINAL_KEY_ACTIONS)[number]
export const KEY_PLATFORM = { mac: 'mac', other: 'other' } as const
export type KeyPlatform = (typeof KEY_PLATFORM)[keyof typeof KEY_PLATFORM]

export interface KeyLike {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  type?: string
}

const KEYDOWN = 'keydown'
const LETTER = { c: 'c', v: 'v', f: 'f' } as const

function macAction(key: string, e: KeyLike, hasSelection: boolean): TerminalKeyAction | null {
  if (!e.metaKey || e.ctrlKey) return null
  if (key === LETTER.c) return hasSelection ? TERMINAL_KEY_ACTION.copy : null
  if (key === LETTER.v) return TERMINAL_KEY_ACTION.paste
  if (key === LETTER.f && !e.shiftKey) return TERMINAL_KEY_ACTION.search
  return null
}

function otherAction(key: string, e: KeyLike, hasSelection: boolean): TerminalKeyAction | null {
  if (!e.ctrlKey || e.metaKey) return null
  if (!e.shiftKey) return key === LETTER.f ? TERMINAL_KEY_ACTION.search : null // plain Ctrl+C stays SIGINT
  if (key === LETTER.c) return hasSelection ? TERMINAL_KEY_ACTION.copy : null
  if (key === LETTER.v) return TERMINAL_KEY_ACTION.paste
  return null
}

/** The terminal's own shortcut for a key event, or null to let xterm (and the program) have the key. */
export function classifyKey(e: KeyLike, platform: KeyPlatform, hasSelection: boolean): TerminalKeyAction | null {
  if (e.type !== undefined && e.type !== KEYDOWN) return null
  const key = e.key.toLowerCase()
  return platform === KEY_PLATFORM.mac ? macAction(key, e, hasSelection) : otherAction(key, e, hasSelection)
}

export const keyPlatform = (userAgent: string): KeyPlatform =>
  /Mac/.test(userAgent) ? KEY_PLATFORM.mac : KEY_PLATFORM.other
