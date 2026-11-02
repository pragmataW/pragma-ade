import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NOTICE_MS } from '../../../constants'
import {
  type ChatImage,
  type ChatSessionApi,
  COMPOSER_ENTRY_KIND,
  type ComposerApi,
  type ComposerChipEntry,
  type ComposerEntry,
  type ComposerExtension,
} from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { appendDraft, composeOutgoing } from '../../lib/compose-outgoing'
import { useChatStore } from '../../session/store'
import { findTrigger, type OpenMenu } from './triggers'

const KEY = { enter: 'Enter', tab: 'Tab', escape: 'Escape', up: 'ArrowUp', down: 'ArrowDown' } as const

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
  const chips = useComposerInbox(session.sessionId, setTextState)
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
    const outgoing = composeOutgoing(chips.list, text)
    if (!outgoing.trim() && images.length === 0) return
    const input = { text: outgoing, images }
    setTextState('')
    setImages([])
    chips.clear()
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
    chips,
  }
}

const isChip = (e: ComposerEntry): e is ComposerChipEntry => e.kind === COMPOSER_ENTRY_KIND.chip

/**
 * 11c: takes the session's main-side inbox on mount and on every `chat.composerInboxChanged`; text entries go into
 * the draft (blank line between), chip entries become removable chips. Nothing is ever sent from here.
 */
function useComposerInbox(sessionId: string, setText: (update: (t: string) => string) => void) {
  const host = useChatHost()
  const version = useChatStore((s) => s.inboxVersions[sessionId] ?? 0)
  const [list, setList] = useState<ComposerChipEntry[]>([])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    void version
    host
      .takeComposerInbox(sessionId)
      .then((entries) => {
        // a take is never discarded on re-run: its entries are gone from main once returned
        if (!alive.current) return
        const add = entries.filter((e) => !isChip(e)).map((e) => e.text)
        if (add.length > 0) setText((t) => add.reduce(appendDraft, t))
        const more = entries.filter(isChip)
        if (more.length > 0) setList((l) => [...l, ...more])
      })
      .catch((e: unknown) => console.warn(`chat: composer inbox of ${sessionId} failed`, e))
  }, [host, sessionId, version, setText])
  return {
    list,
    remove: (id: string) => setList((l) => l.filter((c) => c.id !== id)),
    clear: () => setList([]),
  }
}
