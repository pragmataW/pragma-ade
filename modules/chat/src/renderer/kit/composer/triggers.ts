import type { ComposerExtension } from '../../../contract'

export interface OpenMenu {
  ext: ComposerExtension
  /** Index of the trigger character. */
  start: number
  /** Text between the trigger and the cursor. */
  query: string
}

const WHITESPACE = /\s/
const NEWLINE = '\n'

/** The extension menu the cursor is in: a trigger char at a valid position, no whitespace up to the cursor. */
export function findTrigger(text: string, cursor: number, extensions: readonly ComposerExtension[]): OpenMenu | null {
  let i = cursor - 1
  while (i >= 0 && !WHITESPACE.test(text[i] ?? '')) i--
  const start = i + 1
  const ext = extensions.find((e) => e.trigger && text[start] === e.trigger.char)
  if (!ext?.trigger || start >= cursor) return null
  const before = text[start - 1]
  const valid = ext.trigger.atLineStart
    ? start === 0 || before === NEWLINE
    : start === 0 || WHITESPACE.test(before ?? '')
  return valid ? { ext, start, query: text.slice(start + 1, cursor) } : null
}
