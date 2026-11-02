import { z } from '@pragma/sdk'
import { MARKDOWN_LINK_RE, MARKDOWN_SYNTAX_RE } from '../../constants'
import { type ChatItem, type ChatPartComponent, type ChatPartKey, EVENT_KIND } from '../../contract'
import { type ChatRow, partKeyOf, ROW_KIND } from '../kit/parts/rows'

export const searchMatchSchema = z.object({ rowIndex: z.number().int(), occurrence: z.number().int() })
export type SearchMatch = z.infer<typeof searchMatchSchema>

const NONE = ''
const SPACE = ' '

/** Assistant Markdown as the reader sees it: link targets and syntax characters removed. */
export const stripMarkdown = (md: string): string =>
  md.replace(MARKDOWN_LINK_RE, '$1').replace(MARKDOWN_SYNTAX_RE, NONE)

/** What the user can read of one item: user text, assistant text, tool titles (no thinking, output or customs). */
function itemText(item: ChatItem, parts: Partial<Record<ChatPartKey, ChatPartComponent>>): string {
  if (!parts[partKeyOf(item)]) return NONE
  switch (item.kind) {
    case EVENT_KIND.message:
      return item.text
    case EVENT_KIND.textDelta:
      return stripMarkdown(item.text)
    case EVENT_KIND.toolCall:
      return item.title ?? item.name
    default:
      return NONE
  }
}

/** Plain text per message-list row (same order and indexes as `buildRows`). */
export function buildSearchIndex(
  rows: readonly ChatRow[],
  parts: Partial<Record<ChatPartKey, ChatPartComponent>>,
): string[] {
  return rows.map((row) => {
    if (row.kind === ROW_KIND.group) return row.items.map((i) => itemText(i, parts)).join(SPACE)
    if (row.kind === ROW_KIND.turnHeader) return NONE
    return itemText(row.item, parts)
  })
}

/** Case-insensitive literal matches, row by row; `''` finds nothing. */
export function findMatches(index: readonly string[], query: string): SearchMatch[] {
  const needle = query.toLowerCase()
  if (!needle) return []
  return index.flatMap((text, rowIndex) => {
    const hay = text.toLowerCase()
    const found: SearchMatch[] = []
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length))
      found.push({ rowIndex, occurrence: found.length })
    return found
  })
}
