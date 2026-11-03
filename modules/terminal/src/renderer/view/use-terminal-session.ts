import { debounce } from '@pragma/sdk'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { Terminal } from '@xterm/xterm'
import { type Dispatch, type RefObject, useEffect, useRef } from 'react'
import { RESIZE_DEBOUNCE_MS } from '../../constants'
import {
  type PtyAttachResult,
  type PtyExit,
  type TerminalSettings,
  terminalIpc,
  terminalIpcEvents,
} from '../../contract'
import { getRuntime } from '../runtime'
import { createAttachGate } from './attach-gate'
import { type ActiveRenderer, loadPreferredRenderer } from './renderer-choice'
import { VIEW_ACTION, type ViewAction } from './view-state'
import { installWheelScroll } from './wheel-scroll'

const UNICODE_VERSION = '11'

export interface SessionCallbacks {
  onExit?(exit: PtyExit): void
  onTitleChange?(title: string): void
  onRenderer(renderer: ActiveRenderer): void
  /** Lets later features (search, links, keys) hook into the live xterm instance. */
  onTerminal?(term: Terminal): (() => void) | undefined
}

export interface SessionOptions {
  ptyId: string
  host: RefObject<HTMLDivElement | null>
  settings: TerminalSettings
  theme: Terminal['options']['theme']
  autoFocus: boolean
  dispatch: Dispatch<ViewAction>
  callbacks: RefObject<SessionCallbacks>
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

function createTerminal(o: SessionOptions, latest: RefObject<SessionOptions>): { term: Terminal; fit: FitAddon } {
  const { fontFamily, fontSize, scrollback, scrollSensitivity, fastScrollSensitivity } = o.settings
  const term = new Terminal({
    allowProposedApi: true,
    fontFamily,
    fontSize,
    scrollback,
    scrollSensitivity,
    fastScrollSensitivity,
    theme: o.theme,
    cursorBlink: true,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new Unicode11Addon())
  term.unicode.activeVersion = UNICODE_VERSION
  installWheelScroll(term, () => latest.current.settings)
  return { term, fit }
}

/** Fits on every container resize (skipped while hidden: 0×0) and tells the pty the new size, debounced. */
function watchSize(o: SessionOptions, term: Terminal, fit: FitAddon, el: HTMLElement): () => void {
  const { ipc } = getRuntime()
  const send = debounce((cols: number, rows: number) => {
    ipc.invoke(terminalIpc.ptyResize, { ptyId: o.ptyId, cols, rows }).catch(() => undefined)
  }, RESIZE_DEBOUNCE_MS)
  const resized = term.onResize(({ cols, rows }) => send(cols, rows))
  const observer = new ResizeObserver(() => {
    if (el.clientWidth > 0 && el.clientHeight > 0) fit.fit()
  })
  observer.observe(el)
  return () => {
    observer.disconnect()
    resized.dispose()
    send.cancel()
  }
}

/** Snapshot first, then the live data the snapshot does not cover (subscribed before the snapshot request). */
function attach(o: SessionOptions, term: Terminal, fit: FitAddon, alive: () => boolean): () => void {
  const { ipc } = getRuntime()
  const gate = createAttachGate()
  const data = ipc.subscribe(terminalIpcEvents.ptyData, (e) => {
    if (e.ptyId !== o.ptyId) return
    if (!gate.isOpen) {
      gate.push(e)
      return
    }
    const d = gate.accept(e)
    if (d !== null) term.write(d)
  })
  const exit = ipc.subscribe(terminalIpcEvents.ptyExit, (e) => {
    if (e.ptyId !== o.ptyId) return
    o.dispatch({ type: VIEW_ACTION.exit, exit: e })
    o.callbacks.current.onExit?.(e)
  })
  const restore = (res: PtyAttachResult): void => {
    if (!alive()) return
    if (!res.found) {
      o.dispatch({ type: VIEW_ACTION.notFound })
      return
    }
    term.resize(res.snapshot.cols, res.snapshot.rows)
    term.write(res.snapshot.data)
    for (const d of gate.open(res.snapshot.seq)) term.write(d)
    o.dispatch({ type: VIEW_ACTION.attached, info: res.info, exit: res.exit })
    if (res.exit) o.callbacks.current.onExit?.(res.exit)
    fit.fit()
  }
  ipc
    .invoke(terminalIpc.ptyAttach, { ptyId: o.ptyId })
    .then(restore)
    .catch((error: unknown) => alive() && o.dispatch({ type: VIEW_ACTION.failed, message: messageOf(error) }))
  return () => {
    data.dispose()
    exit.dispose()
  }
}

function forwardInput(o: SessionOptions, term: Terminal): () => void {
  const { ipc } = getRuntime()
  const input = term.onData((data) => {
    ipc.invoke(terminalIpc.ptyWrite, { ptyId: o.ptyId, data }).catch(() => undefined)
  })
  const title = term.onTitleChange((t) => o.callbacks.current.onTitleChange?.(t))
  return () => {
    input.dispose()
    title.dispose()
  }
}

/** Owns one xterm instance bound to a pty for the lifetime of `ptyId`. */
export function useTerminalSession(o: SessionOptions): RefObject<Terminal | null> {
  const termRef = useRef<Terminal | null>(null)
  const latest = useRef(o)
  latest.current = o
  // biome-ignore lint/correctness/useExhaustiveDependencies: one xterm per ptyId; options are read through `latest`
  useEffect(() => {
    const el = o.host.current
    if (!el) return
    const opts = latest.current
    let alive = true
    const { term, fit } = createTerminal(opts, latest)
    term.open(el)
    opts.callbacks.current.onRenderer(loadPreferredRenderer(term, opts.settings.renderer))
    termRef.current = term
    const cleanups = [
      attach(opts, term, fit, () => alive),
      forwardInput(opts, term),
      watchSize(opts, term, fit, el),
      opts.callbacks.current.onTerminal?.(term),
    ]
    if (opts.autoFocus) term.focus()
    return () => {
      alive = false
      for (const c of cleanups) c?.()
      termRef.current = null
      term.dispose()
    }
  }, [o.ptyId])
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = o.theme
  }, [o.theme])
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = o.settings.fontFamily
    term.options.fontSize = o.settings.fontSize
  }, [o.settings.fontFamily, o.settings.fontSize])
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.scrollSensitivity = o.settings.scrollSensitivity
    term.options.fastScrollSensitivity = o.settings.fastScrollSensitivity
  }, [o.settings.scrollSensitivity, o.settings.fastScrollSensitivity])
  return termRef
}
