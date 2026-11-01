import { CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { BUTTON_TYPE, ICONS, PERCENT, TOOLBAR_PX } from '../constants'
import {
  BrowserIpc,
  type BrowserTabState,
  HISTORY_ACTION,
  type HistoryAction,
  BROWSER_TEST_IDS as T,
  ZOOM_ACTION,
  type ZoomAction,
} from '../contract'
import { AddressBar } from './AddressBar'
import { send } from './lib/ipc'
import { runtime, useBrowser } from './runtime'
import { ToolButton } from './ToolButton'

const history = (tab: BrowserTabState | null, action: HistoryAction) => () =>
  tab && send(BrowserIpc.history, { tabId: tab.id, action })
const zoom = (tab: BrowserTabState | null, action: ZoomAction) => () =>
  tab && send(BrowserIpc.zoom, { tabId: tab.id, action })

function PickToggle({ tab }: { tab: BrowserTabState | null }) {
  const t = useT()
  const armed = useBrowser((s) => tab !== null && s.snapshot?.pickerArmedTabId === tab.id)
  const available = runtime().ctx.services.tryGet(CommentsUiServiceToken) !== undefined
  const channel = armed ? BrowserIpc.pickerCancel : BrowserIpc.pickerStart
  return (
    <ToolButton
      icon={ICONS.pick}
      label={t(available ? 'browser:picker.toggle' : 'browser:picker.unavailable')}
      testId={T.pickToggle}
      active={armed}
      disabled={!available || !tab}
      onClick={() => tab && send(channel, { tabId: tab.id })}
    />
  )
}

function ZoomControls({ tab }: { tab: BrowserTabState | null }) {
  const t = useT()
  const percent = Math.round((tab?.zoomFactor ?? 1) * PERCENT)
  return (
    <>
      <ToolButton
        icon={ICONS.zoomOut}
        label={t('browser:toolbar.zoomOut')}
        testId={T.zoomOut}
        disabled={!tab}
        onClick={zoom(tab, ZOOM_ACTION.out)}
      />
      <button
        type={BUTTON_TYPE}
        data-testid={T.zoomReset}
        title={t('browser:toolbar.zoomReset', { percent })}
        disabled={!tab}
        onClick={zoom(tab, ZOOM_ACTION.reset)}
        className="w-9 shrink-0 text-center font-mono text-[11px] text-[var(--mu)] hover:text-[var(--tx)] disabled:opacity-40"
      >
        {`${percent}%`}
      </button>
      <ToolButton
        icon={ICONS.zoomIn}
        label={t('browser:toolbar.zoomIn')}
        testId={T.zoomIn}
        disabled={!tab}
        onClick={zoom(tab, ZOOM_ACTION.in)}
      />
    </>
  )
}

/** Back/forward/reload, address bar, pick toggle, zoom and DevTools; a fixed `TOOLBAR_PX` row. */
export function Toolbar({ tab }: { tab: BrowserTabState | null }) {
  const t = useT()
  const loading = tab?.isLoading ?? false
  return (
    <div
      style={{ height: TOOLBAR_PX }}
      className="flex shrink-0 items-center gap-0.5 border-b border-[var(--bd)] bg-[var(--pn)] px-1"
    >
      <ToolButton
        icon={ICONS.back}
        label={t('browser:toolbar.back')}
        testId={T.back}
        disabled={!tab?.canGoBack}
        onClick={history(tab, HISTORY_ACTION.back)}
      />
      <ToolButton
        icon={ICONS.forward}
        label={t('browser:toolbar.forward')}
        testId={T.forward}
        disabled={!tab?.canGoForward}
        onClick={history(tab, HISTORY_ACTION.forward)}
      />
      <ToolButton
        icon={loading ? ICONS.stop : ICONS.reload}
        label={t(loading ? 'browser:toolbar.stop' : 'browser:toolbar.reload')}
        testId={T.reload}
        disabled={!tab}
        onClick={history(tab, loading ? HISTORY_ACTION.stop : HISTORY_ACTION.reload)}
      />
      <AddressBar key={tab?.id ?? ''} tab={tab} />
      <PickToggle tab={tab} />
      <ZoomControls tab={tab} />
      <ToolButton
        icon={ICONS.devtools}
        label={t('browser:toolbar.devtools')}
        testId={T.devtools}
        active={tab?.devToolsOpen ?? false}
        disabled={!tab}
        onClick={() => tab && send(BrowserIpc.toggleDevTools, { tabId: tab.id })}
      />
    </div>
  )
}
