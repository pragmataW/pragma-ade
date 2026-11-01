import { ELLIPSIS, TITLE_MAX_CHARS } from '../../constants'

const WHITESPACE_RUN = /\s+/g
const LINE_BREAK = /\r?\n/

/** First non-empty prompt line, whitespace collapsed, at most `TITLE_MAX_CHARS` (with `…`); null when blank. */
export function deriveSessionTitle(prompt?: string): string | null {
  const line = (prompt ?? '')
    .split(LINE_BREAK)
    .map((l) => l.replace(WHITESPACE_RUN, ' ').trim())
    .find(Boolean)
  if (!line) return null
  return line.length <= TITLE_MAX_CHARS ? line : `${line.slice(0, TITLE_MAX_CHARS - ELLIPSIS.length)}${ELLIPSIS}`
}
