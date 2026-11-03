import { GitChangesTestIds as T } from '../../contract'
import type { Range } from './match'

/**
 * `text` with the filter's matched ranges marked. Ranges are code-unit offsets that the matcher took from grapheme
 * boundaries of this very string, so a mark never cuts a combining mark, a surrogate pair or a ZWJ emoji apart.
 */
export function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  if (ranges.length === 0) return text
  const parts: React.ReactNode[] = []
  let at = 0
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark key={start} data-testid={T.filterMatch} className="gc-match">
        {text.slice(start, end)}
      </mark>,
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}
