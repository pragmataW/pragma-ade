import { LINE_SPLIT_RE, NEWLINE, TABLE_ROW_RE } from '../../constants'

const isRow = (line: string): boolean => TABLE_ROW_RE.test(line)

/**
 * Streaming text without the table lines that would render differently once complete: the row being typed (it may
 * gain cells) and a header row whose delimiter has not arrived yet (it would show as a paragraph, then jump into a
 * table). Everything is shown again as soon as it is stable, so a growing table only ever gains whole rows.
 */
export function holdPartialTable(md: string): string {
  const lines = md.split(LINE_SPLIT_RE)
  const typing = lines.pop() ?? ''
  const pending = typing === '' || isRow(typing)
  let start = lines.length
  while (start > 0 && isRow(lines[start - 1] ?? '')) start--
  if (pending && lines.length - start === 1) return lines.slice(0, start).join(NEWLINE)
  return (isRow(typing) ? lines : [...lines, typing]).join(NEWLINE)
}
