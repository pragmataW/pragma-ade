import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { KEY_ENTER, KEY_ESCAPE, SEARCH_SHORTCUT_KEY } from '../../constants'
import type { ChatItem, ChatPartComponent, ChatPartKey } from '../../contract'
import type { MessageListHandle } from '../kit/parts/MessageList'
import { buildRows } from '../kit/parts/rows'
import { buildSearchIndex, findMatches, type SearchMatch } from '../lib/search-index'

export interface ChatSearchInput {
  items: readonly ChatItem[]
  parts: Partial<Record<ChatPartKey, ChatPartComponent>>
  groupToolCalls: boolean
  turnHeader: boolean
  list: RefObject<MessageListHandle | null>
}

export interface ChatSearch {
  open: boolean
  query: string
  setQuery(q: string): void
  matches: SearchMatch[]
  /** Index into `matches` (0 when there are none). */
  current: number
  next(): void
  previous(): void
  close(): void
  input: RefObject<HTMLInputElement | null>
  /** `onKeyDownCapture` of the chat view root (Mod+F), so the terminal's own Cmd+F stays untouched. */
  onViewKeyDown(e: KeyboardEvent): void
  /** `onKeyDown` of the search field: Enter / Shift+Enter move (wrapping), Esc closes. */
  onInputKeyDown(e: KeyboardEvent): void
}

const wrap = (i: number, n: number): number => (n === 0 ? 0 : (i + n) % n)

/** In-chat search over what the user can see (same rows as the message list); navigating scrolls to the match. */
export function useChatSearch(o: ChatSearchInput): ChatSearch {
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [current, setCurrent] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const { items, parts, groupToolCalls, turnHeader, list } = o
  const index = useMemo(
    () => buildSearchIndex(buildRows(items, parts, { groupToolCalls, turnHeader }), parts),
    [items, parts, groupToolCalls, turnHeader],
  )
  const matches = useMemo(() => findMatches(index, query), [index, query])
  const target = matches[current]
  useEffect(() => {
    if (open && target) list.current?.scrollToIndex(target.rowIndex)
  }, [open, target, list])
  const move = (by: number) => setCurrent((c) => wrap(c + by, matches.length))
  const close = () => {
    setOpen(false)
    setQueryState('')
    setCurrent(0)
  }
  return {
    open,
    query,
    setQuery: (q) => {
      setQueryState(q)
      setCurrent(0)
    },
    matches,
    current,
    next: () => move(1),
    previous: () => move(-1),
    close,
    input,
    onViewKeyDown(e) {
      if (e.key.toLowerCase() !== SEARCH_SHORTCUT_KEY || !(e.metaKey || e.ctrlKey) || e.altKey) return
      e.preventDefault()
      setOpen(true)
      queueMicrotask(() => input.current?.focus())
    },
    onInputKeyDown(e) {
      if (e.key === KEY_ENTER) {
        e.preventDefault()
        move(e.shiftKey ? -1 : 1)
      } else if (e.key === KEY_ESCAPE) {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    },
  }
}
