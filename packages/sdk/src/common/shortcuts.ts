import { z } from 'zod'
import { PLATFORM } from '../constants'
import { CommandRefSchema } from './commands'

export const SHORTCUT_SCOPES = ['global', 'app'] as const
export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number]

export const ShortcutSpecSchema = z.object({
  id: z.string().min(1),
  /** Electron accelerator syntax, e.g. `CmdOrCtrl+Shift+P`. */
  accelerator: z.string().min(1),
  scope: z.enum(SHORTCUT_SCOPES),
  command: z.union([z.string().min(1), CommandRefSchema]),
  titleKey: z.string().optional(),
})
export type ShortcutSpec = z.infer<typeof ShortcutSpecSchema>

/** VS Code chords that must never be captured globally while an editor/browser view has focus (§10.2). */
export const RESERVED_EDITOR_CHORDS = [
  'CmdOrCtrl+K',
  'CmdOrCtrl+P',
  'CmdOrCtrl+Shift+P',
  'CmdOrCtrl+Shift+F',
  'CmdOrCtrl+B',
  'CmdOrCtrl+J',
  'CmdOrCtrl+`',
] as const

export interface KeyInput {
  key: string
  meta: boolean
  control: boolean
  shift: boolean
  alt: boolean
}
export type KeyChord = KeyInput

/** The subset of Electron's `Input` (before-input-event) used for matching. */
export interface ElectronInputLike extends KeyInput {
  code?: string
}

/** Structural subset of the DOM `KeyboardEvent` (the common code is compiled without the DOM lib). */
export interface KeyboardEventLike {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

type Modifier = 'meta' | 'control' | 'shift' | 'alt'

const PLATFORM_MOD = (platform: string): Modifier => (platform === PLATFORM.darwin ? 'meta' : 'control')

const MODIFIER_TOKENS: Record<string, (platform: string) => Modifier> = {
  cmdorctrl: PLATFORM_MOD,
  commandorcontrol: PLATFORM_MOD,
  cmd: () => 'meta',
  command: () => 'meta',
  super: () => 'meta',
  meta: () => 'meta',
  ctrl: () => 'control',
  control: () => 'control',
  alt: () => 'alt',
  option: () => 'alt',
  altgr: () => 'alt',
  shift: () => 'shift',
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  space: ' ',
  plus: '+',
}

const LETTER_OR_DIGIT_CODE = /^(?:Key(?<letter>[A-Z])|Digit(?<digit>[0-9]))$/

const normalizeKey = (key: string): string => {
  const lower = key.toLowerCase()
  return KEY_ALIASES[lower] ?? lower
}

export class InvalidAcceleratorError extends Error {}

export function parseAccelerator(acc: string, platform: string): KeyChord {
  const chord: KeyChord = { key: '', meta: false, control: false, shift: false, alt: false }
  for (const token of acc.split('+')) {
    const modifier = MODIFIER_TOKENS[token.toLowerCase()]
    if (modifier) chord[modifier(platform)] = true
    else chord.key = normalizeKey(token)
  }
  if (!chord.key) throw new InvalidAcceleratorError(`accelerator "${acc}" has no key`)
  return chord
}

export const matchesChord = (chord: KeyChord, input: KeyInput): boolean =>
  chord.key === normalizeKey(input.key) &&
  chord.meta === input.meta &&
  chord.control === input.control &&
  chord.shift === input.shift &&
  chord.alt === input.alt

const isDomEvent = (e: KeyboardEventLike | ElectronInputLike): e is KeyboardEventLike => 'metaKey' in e

function keyFromCode(code: string | undefined, key: string): string {
  const groups = code ? LETTER_OR_DIGIT_CODE.exec(code)?.groups : undefined
  return normalizeKey(groups?.letter ?? groups?.digit ?? key)
}

/** Maps a DOM `KeyboardEvent` or an Electron `Input` to a `KeyInput` (letters/digits use the physical code). */
export function toKeyInput(e: KeyboardEventLike | ElectronInputLike): KeyInput {
  if (isDomEvent(e))
    return { key: keyFromCode(e.code, e.key), meta: e.metaKey, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey }
  return { key: keyFromCode(e.code, e.key), meta: e.meta, control: e.control, shift: e.shift, alt: e.alt }
}

export const matchShortcut = (
  event: KeyboardEventLike | ElectronInputLike | KeyInput,
  accelerator: string,
  platform: string,
): boolean => matchesChord(parseAccelerator(accelerator, platform), toKeyInput(event))

export const chordId = (c: KeyChord): string =>
  [c.meta && 'meta', c.control && 'control', c.alt && 'alt', c.shift && 'shift', c.key].filter(Boolean).join('+')
