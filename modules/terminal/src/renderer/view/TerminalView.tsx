import '@xterm/xterm/css/xterm.css'
import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { type TerminalSettings, TerminalTestIds, type TerminalViewProps } from '../../contract'
import { exitText } from '../panel/labels'
import { getRuntime, readSettings } from '../runtime'
import { ACTIVE_RENDERERS, type ActiveRenderer } from './renderer-choice'
import { SearchBar } from './SearchBar'
import { StatusBanner } from './StatusBanner'
import { useTerminalFeatures } from './use-terminal-features'
import { type SessionCallbacks, useTerminalSession } from './use-terminal-session'
import { useXtermTheme } from './use-xterm-theme'
import { INITIAL_VIEW_STATE, VIEW_STATE, type ViewState, viewReducer } from './view-state'

function useTerminalSettings(): TerminalSettings {
  const { settings } = getRuntime()
  const raw = useSyncExternalStore(
    (cb) => {
      const sub = settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => settings.get(),
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-parsed only when the section object changes
  return useMemo(() => readSettings(), [raw])
}

type T = ReturnType<typeof useT>

function bannerText(state: ViewState, t: T): string | null {
  switch (state.kind) {
    case VIEW_STATE.exited:
      return exitText(state.exit, t)
    case VIEW_STATE.notFound:
      return t('terminal:status.notFound')
    case VIEW_STATE.error:
      return t('terminal:status.error', { message: state.message })
    case VIEW_STATE.attaching:
    case VIEW_STATE.live:
      return null
    default: {
      const never: never = state
      return never
    }
  }
}

/** A terminal bound to a pty: snapshot restore, live output, input and resize. Used by the panel and by agents. */
/** `searchRequest` (panel-internal): a changed non-zero value opens the find bar (`terminal.focusSearch`). */
export function TerminalView({
  ptyId,
  className,
  autoFocus = false,
  onExit,
  onTitleChange,
  searchRequest = 0,
}: TerminalViewProps & { searchRequest?: number }) {
  const t = useT()
  const settings = useTerminalSettings()
  const theme = useXtermTheme(getRuntime().theme)
  const [state, dispatch] = useReducer(viewReducer, INITIAL_VIEW_STATE)
  const [renderer, setRenderer] = useState<ActiveRenderer>(ACTIVE_RENDERERS.dom)
  const host = useRef<HTMLDivElement>(null)
  const features = useTerminalFeatures()
  const callbacks = useRef<SessionCallbacks>({ onRenderer: setRenderer })
  callbacks.current = { onExit, onTitleChange, onRenderer: setRenderer, onTerminal: features.onTerminal }
  const term = useTerminalSession({ ptyId, host, settings, theme, autoFocus, dispatch, callbacks })
  const { openSearch } = features
  useEffect(() => {
    if (searchRequest > 0) openSearch()
  }, [searchRequest, openSearch])
  const closeSearch = () => {
    features.closeSearch()
    term.current?.focus()
  }
  const banner = bannerText(state, t)
  return (
    <div
      data-testid={TerminalTestIds.view}
      data-pty-id={ptyId}
      data-renderer={renderer}
      data-state={state.kind}
      className={cn('relative flex h-full min-h-0 w-full flex-col', className)}
      style={{ background: theme.background }}
    >
      <div ref={host} className="min-h-0 flex-1 overflow-hidden px-2 pt-1" />
      {features.searchOpen && features.search && <SearchBar search={features.search} onClose={closeSearch} />}
      {features.linkHovered && (
        <div className="pointer-events-none absolute right-3 bottom-2 rounded-[var(--radius-chip)] border border-bd bg-el px-2 py-0.5 text-[11px] text-mu">
          {t('terminal:link.hint')}
        </div>
      )}
      {banner && <StatusBanner text={banner} />}
    </div>
  )
}
