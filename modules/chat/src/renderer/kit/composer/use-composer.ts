import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NOTICE_MS } from '../../../constants'
import type { ChatImage, ChatSessionApi, ComposerApi, ComposerExtension } from '../../../contract'
import { useChatStore } from '../../session/store'
import { findTrigger, type OpenMenu } from './triggers'

const KEY = { enter: 'Enter', tab: 'Tab', escape: 'Escape', up: 'ArrowUp', down: 'ArrowDown' } as const
const APPEND_SEPARATOR = '\n'

/** Composer state: text, images, the open trigger menu, sending, and appended texts (never auto-sent). */
export function useComposer(session: ChatSessionApi, extensions: readonly ComposerExtension[]) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setTextState] = useState('')
  const [images, setImages] = useState<ChatImage[]>([])
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [pickRequest, setPickRequest] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const sync = useCallback(
    (next: string, cursor: number) => {
      setTextState(next)
      setMenu(findTrigger(next, cursor, extensions))
      setActiveIndex(0)
    },
    [extensions],
  )
  const appended = useChatStore((s) => s.appends[session.sessionId]?.length ?? 0)
  useEffect(() => {
    if (appended === 0) return
    const add = useChatStore.getState().consumeComposerAppend(session.sessionId).join(APPEND_SEPARATOR)
    setTextState((t) => (t ? `${t}${APPEND_SEPARATOR}${add}` : add))
  }, [appended, session.sessionId])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const api: ComposerApi = useMemo(
    () => ({
      text,
      setText: (t) => sync(t, t.length),
      insertAtCursor(t) {
        const el = ref.current
        const at = el?.selectionStart ?? text.length
        sync(text.slice(0, at) + t + text.slice(el?.selectionEnd ?? at), at + t.length)
      },
      replaceToken(start, end, t) {
        const next = text.slice(0, start) + t + text.slice(end)
        sync(next, start + t.length)
        setMenu(null)
        queueMicrotask(() => ref.current?.setSelectionRange(start + t.length, start + t.length))
      },
      images,
      addImages: (more) => setImages((i) => [...i, ...more]),
      removeImage: (index) => setImages((i) => i.filter((_, k) => k !== index)),
      notify: setNotice,
      session,
    }),
    [text, images, session, sync],
  )

  const send = async () => {
    if (!text.trim() && images.length === 0) return
    const input = { text, images }
    setTextState('')
    setImages([])
    setMenu(null)
    await session.send(input)
  }

  const pick = (insert: string) => {
    if (!menu) return
    const cursor = ref.current?.selectionStart ?? text.length
    api.replaceToken(menu.start, cursor, insert)
  }

  const MENU_KEYS: Record<string, () => void> = {
    [KEY.escape]: () => setMenu(null),
    [KEY.down]: () => setActiveIndex((i) => (count === 0 ? 0 : (i + 1) % count)),
    [KEY.up]: () => setActiveIndex((i) => (count === 0 ? 0 : (i - 1 + count) % count)),
    [KEY.enter]: () => setPickRequest((n) => n + 1),
    [KEY.tab]: () => setPickRequest((n) => n + 1),
  }
  const PICK_KEYS = new Set<string>([KEY.enter, KEY.tab])

  /** Up/Down move, Enter/Tab pick (when there are items), Esc closes; true when handled. */
  function onMenuKey(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    const action = MENU_KEYS[e.key]
    if (!action || (PICK_KEYS.has(e.key) && count === 0)) return false
    action()
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu && onMenuKey(e)) return
    if (e.key !== KEY.enter || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void send()
  }

  return {
    ref,
    api,
    menu,
    activeIndex,
    setCount,
    pickRequest,
    pick,
    closeMenu: () => setMenu(null),
    send,
    onKeyDown,
    sync,
    notice,
  }
}
