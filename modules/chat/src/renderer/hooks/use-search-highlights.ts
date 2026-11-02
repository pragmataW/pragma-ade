import { type RefObject, useEffect } from 'react'
import { CHAT_ROW_ATTR, SEARCH_HIGHLIGHT, SEARCH_HIGHLIGHT_CURRENT } from '../../constants'
import type { MessageListHandle } from '../kit/parts/MessageList'
import type { SearchMatch } from '../lib/search-index'

interface HighlightRegistry {
  set(name: string, h: unknown): void
  delete(name: string): void
}
type HighlightCtor = new (...ranges: Range[]) => unknown
/** The CSS Custom Highlight API, when the engine has it (else the search only scrolls). */
function highlightApi(): { registry: HighlightRegistry; Highlight: HighlightCtor } | null {
  const g = globalThis as unknown as { CSS?: { highlights?: HighlightRegistry }; Highlight?: HighlightCtor }
  return g.CSS?.highlights && g.Highlight ? { registry: g.CSS.highlights, Highlight: g.Highlight } : null
}

/** Ranges of `needle` (lower-case) in the text nodes under `root`. */
function rangesIn(root: Element, needle: string): Range[] {
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const hay = (node.textContent ?? '').toLowerCase()
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
      const r = document.createRange()
      r.setStart(node, at)
      r.setEnd(node, at + needle.length)
      ranges.push(r)
    }
  }
  return ranges
}

/** Paints `chat-search` (every visible hit) and `chat-search-current` (the selected one) inside `[data-chat-row]`. */
export function useSearchHighlights(
  list: RefObject<MessageListHandle | null>,
  scope: RefObject<HTMLElement | null>,
  query: string,
  current: SearchMatch | undefined,
) {
  useEffect(() => {
    const api = highlightApi()
    const root = scope.current
    if (!api || !root) return
    const clear = () => {
      api.registry.delete(SEARCH_HIGHLIGHT)
      api.registry.delete(SEARCH_HIGHLIGHT_CURRENT)
    }
    const needle = query.toLowerCase()
    if (!needle) return clear
    const paint = () => {
      const all = [...root.querySelectorAll(`[${CHAT_ROW_ATTR}]`)].flatMap((row) => rangesIn(row, needle))
      api.registry.set(SEARCH_HIGHLIGHT, new api.Highlight(...all))
      const row = current ? list.current?.rowElement(current.rowIndex) : null
      const hit = row ? rangesIn(row, needle)[current?.occurrence ?? 0] : undefined
      if (hit) api.registry.set(SEARCH_HIGHLIGHT_CURRENT, new api.Highlight(hit))
      else api.registry.delete(SEARCH_HIGHLIGHT_CURRENT)
    }
    // rows render after the virtualizer scrolled: repaint whenever the list DOM changes
    const observer = new MutationObserver(paint)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    paint()
    return () => {
      observer.disconnect()
      clear()
    }
  }, [list, scope, query, current])
}
