import { createContext, type RefObject, useContext, useEffect, useState } from 'react'
import type { ChatItemKind } from '../../contract'

/** What the chat view offers the parts and slots composed into it (provided by `ChatSessionView`). */
export interface ChatLayoutApi {
  /** Scrolls the main transcript to the row showing the item; false when the list does not show it. */
  revealItem(kind: ChatItemKind, id: string): boolean
  /** The transcript area: a side panel overlays it (portal) when docking would squeeze the chat too much. */
  overlayHost: HTMLElement | null
  /** Width of the chat body (transcript column plus docked side panels). */
  bodyWidth: number
}

const ChatLayoutContext = createContext<ChatLayoutApi | null>(null)
export const ChatLayoutProvider = ChatLayoutContext.Provider
/** Null outside a chat view (a part rendered on its own, tests). */
export const useChatLayout = (): ChatLayoutApi | null => useContext(ChatLayoutContext)

/** The element's width, kept current by a `ResizeObserver`. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.offsetWidth)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}
