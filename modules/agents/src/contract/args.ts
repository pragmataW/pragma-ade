/**
 * POSIX-like argument splitting for profile argument strings, identical on every OS. No `$`, `~` or glob expansion;
 * `'…'` is literal; in `"…"` a backslash escapes only `"`, `\`, `$` and `` ` ``; outside quotes it escapes the next char.
 */

export const ARGS_ERROR = { unterminatedQuote: 'unterminatedQuote', trailingBackslash: 'trailingBackslash' } as const
export const argsErrorCodes = [ARGS_ERROR.unterminatedQuote, ARGS_ERROR.trailingBackslash] as const
export type ArgsErrorCode = (typeof argsErrorCodes)[number]

export class ArgsParseError extends Error {
  readonly code: ArgsErrorCode
  readonly index: number
  constructor(code: ArgsErrorCode, index: number) {
    super(`${code} at ${index}`)
    this.name = 'ArgsParseError'
    this.code = code
    this.index = index
  }
}

const SINGLE_QUOTE = "'"
const DOUBLE_QUOTE = '"'
const BACKSLASH = '\\'
const WHITESPACE_RE = /\s/
const DOUBLE_QUOTE_ESCAPABLE = new Set([DOUBLE_QUOTE, BACKSLASH, '$', '`'])
const SAFE_ARG_RE = /^[A-Za-z0-9_\-+=.,/:@%]+$/
const QUOTE_ESCAPE = `'\\''`
/** A backslash plus the character it escapes. */
const ESCAPE_LENGTH = 2

/** One quoted or escaped part: its text and the index after it. */
interface Part {
  text: string
  next: number
}

function readSingle(input: string, start: number): Part {
  const end = input.indexOf(SINGLE_QUOTE, start + 1)
  if (end < 0) throw new ArgsParseError(ARGS_ERROR.unterminatedQuote, start)
  return { text: input.slice(start + 1, end), next: end + 1 }
}

function readDouble(input: string, start: number): Part {
  let text = ''
  for (let i = start + 1; i < input.length; i++) {
    const ch = input[i] as string
    if (ch === DOUBLE_QUOTE) return { text, next: i + 1 }
    const following = input[i + 1]
    if (ch === BACKSLASH && following !== undefined && DOUBLE_QUOTE_ESCAPABLE.has(following)) {
      text += following
      i++
    } else text += ch
  }
  throw new ArgsParseError(ARGS_ERROR.unterminatedQuote, start)
}

function readEscape(input: string, start: number): Part {
  const following = input[start + 1]
  if (following === undefined) throw new ArgsParseError(ARGS_ERROR.trailingBackslash, start)
  return { text: following, next: start + ESCAPE_LENGTH }
}

function readPart(input: string, i: number): Part {
  const ch = input[i] as string
  if (ch === SINGLE_QUOTE) return readSingle(input, i)
  if (ch === DOUBLE_QUOTE) return readDouble(input, i)
  if (ch === BACKSLASH) return readEscape(input, i)
  return { text: ch, next: i + 1 }
}

/** Splits an argument string; throws `ArgsParseError`. */
export function splitArgs(input: string): string[] {
  const out: string[] = []
  let word: string | null = null
  let i = 0
  while (i < input.length) {
    if (WHITESPACE_RE.test(input[i] as string)) {
      if (word !== null) out.push(word)
      word = null
      i++
      continue
    }
    const part = readPart(input, i)
    word = (word ?? '') + part.text
    i = part.next
  }
  if (word !== null) out.push(word)
  return out
}

export type ArgsParseResult = { ok: true; args: string[] } | { ok: false; code: ArgsErrorCode; index: number }

export function tryParseArgs(input: string): ArgsParseResult {
  try {
    return { ok: true, args: splitArgs(input) }
  } catch (error) {
    if (error instanceof ArgsParseError) return { ok: false, code: error.code, index: error.index }
    throw error
  }
}

/** Leaves safe words as they are; otherwise single-quotes (`'` → `'\''`). */
export function quoteArg(arg: string): string {
  if (SAFE_ARG_RE.test(arg)) return arg
  return `${SINGLE_QUOTE}${arg.replaceAll(SINGLE_QUOTE, QUOTE_ESCAPE)}${SINGLE_QUOTE}`
}

/** Arguments as one string that `splitArgs` parses back to the same list. */
export const formatArgs = (args: readonly string[]): string => args.map(quoteArg).join(' ')

/** `command args…` for previews (quoted only where needed). */
export function formatCommandLine(command: string, args: readonly string[]): string {
  return [quoteArg(command), formatArgs(args)].filter(Boolean).join(' ')
}
