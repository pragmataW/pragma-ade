import {
  type ChatItem,
  type ChatPartComponent,
  type ChatPartKey,
  CUSTOM_PART_PREFIX,
  EVENT_KIND,
  parentOf,
  TOOL_KIND,
  type ToolCallItem,
} from '../../../contract'

export type ChatRow =
  | { kind: 'item'; key: string; item: ChatItem }
  | { kind: 'group'; key: string; items: ToolCallItem[] }
  | { kind: 'turn-header'; key: string; at?: number }

export const ROW_KIND = { item: 'item', group: 'group', turnHeader: 'turn-header' } as const
const TURN_HEADER_KEY = 'th:'

export const partKeyOf = (item: ChatItem): ChatPartKey =>
  item.kind === EVENT_KIND.custom ? `${CUSTOM_PART_PREFIX}${item.type}` : item.kind

/**
 * Rows of the message list: items without a part are dropped (unknown customs too); consecutive tool calls become
 * one group (file-edit, todo and permission rows break it); a turn header precedes the first assistant row after
 * each user message.
 */
export function buildRows(
  items: readonly ChatItem[],
  parts: Partial<Record<ChatPartKey, ChatPartComponent>>,
  opts: { groupToolCalls: boolean; turnHeader: boolean },
): ChatRow[] {
  const b = new RowBuilder(opts)
  const nested = nesting(items, Boolean(parts[EVENT_KIND.task]))
  for (const item of items) if (parts[partKeyOf(item)] && !nested(item)) b.add(item)
  return b.rows
}

/**
 * Which items render inside a task card instead of this list: items whose parent (a task or a `task`-kind tool
 * call) is in `items`, and the tool call a rendered task card replaces. Orphans stay in the list.
 */
function nesting(items: readonly ChatItem[], taskCards: boolean): (item: ChatItem) => boolean {
  const owners = new Set<string>()
  const replaced = new Set<string>()
  for (const i of items) {
    if (i.kind === EVENT_KIND.toolCall && i.toolKind === TOOL_KIND.task) owners.add(i.id)
    if (i.kind !== EVENT_KIND.task || !taskCards) continue
    owners.add(i.id)
    if (i.toolCallId) {
      owners.add(i.toolCallId)
      replaced.add(i.toolCallId)
    }
  }
  return (item) => {
    const parent = parentOf(item)
    if (parent && owners.has(parent)) return true
    return item.kind === EVENT_KIND.toolCall && replaced.has(item.id)
  }
}

class RowBuilder {
  readonly rows: ChatRow[] = []
  #lastMessageAt: number | undefined
  #headerPending = false
  readonly #opts: { groupToolCalls: boolean; turnHeader: boolean }

  constructor(opts: { groupToolCalls: boolean; turnHeader: boolean }) {
    this.#opts = opts
  }

  add(item: ChatItem): void {
    if (item.kind === EVENT_KIND.message) {
      this.#message(item)
      return
    }
    this.#header(item.id)
    if (this.#opts.groupToolCalls && item.kind === EVENT_KIND.toolCall) {
      this.#tool(item)
      return
    }
    this.rows.push({ kind: ROW_KIND.item, key: `${item.kind}:${item.id}`, item })
  }

  #message(item: Extract<ChatItem, { kind: typeof EVENT_KIND.message }>): void {
    this.rows.push({ kind: ROW_KIND.item, key: `${item.kind}:${item.id}`, item })
    this.#lastMessageAt = item.at
    this.#headerPending = this.#opts.turnHeader
  }

  #header(id: string): void {
    if (!this.#headerPending) return
    this.rows.push({ kind: ROW_KIND.turnHeader, key: `${TURN_HEADER_KEY}${id}`, at: this.#lastMessageAt })
    this.#headerPending = false
  }

  #tool(item: ToolCallItem): void {
    const last = this.rows.at(-1)
    if (last?.kind === ROW_KIND.group) last.items.push(item)
    else this.rows.push({ kind: ROW_KIND.group, key: `${ROW_KIND.group}:${item.id}`, items: [item] })
  }
}
