import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { useShallow } from 'zustand/react/shallow'
import { FAVICON_PX, ICONS, TAB_STRIP_PX } from '../constants'
import { BROWSER_DATA_ATTRS as A, BrowserIpc, type BrowserTabState, BROWSER_TEST_IDS as T } from '../contract'
import { send } from './lib/ipc'
import { useBrowser } from './runtime'
import { activeTab, activeTabs } from './store'
import { ToolButton } from './ToolButton'

const ENTER = 'Enter'

function TabItem({ tab, active }: { tab: BrowserTabState; active: boolean }) {
  const t = useT()
  const title = tab.title || t('browser:tabs.untitled')
  return (
    <div
      role="tab"
      aria-selected={active}
      data-testid={T.tab}
      {...{ [A.tabId]: tab.id, [A.active]: String(active) }}
      title={tab.url || title}
      tabIndex={active ? 0 : -1}
      onMouseDown={() => send(BrowserIpc.activateTab, { tabId: tab.id })}
      onKeyDown={(e) => e.key === ENTER && send(BrowserIpc.activateTab, { tabId: tab.id })}
      className={cn(
        'flex h-full min-w-0 max-w-[180px] cursor-default items-center gap-1.5 border-r border-[var(--bd)] pr-0.5 pl-2 text-[12px]',
        active
          ? 'bg-[var(--el)] text-[var(--tx)] shadow-[inset_0_2px_0_var(--ac)]'
          : 'text-[var(--mu)] hover:bg-[var(--hv)]',
      )}
    >
      {tab.faviconUrl ? <img src={tab.faviconUrl} alt="" width={FAVICON_PX} height={FAVICON_PX} /> : null}
      <span className="truncate">{title}</span>
      <ToolButton
        icon={ICONS.close}
        label={t('browser:tabs.close')}
        testId={T.tabClose}
        onClick={() => send(BrowserIpc.closeTab, { tabId: tab.id })}
      />
    </div>
  )
}

/** Tabs of the active worktree and `+`. */
export function TabStrip() {
  const t = useT()
  const tabs = useBrowser(useShallow(activeTabs))
  const current = useBrowser(activeTab)
  return (
    <div
      role="tablist"
      data-testid={T.tabStrip}
      style={{ height: TAB_STRIP_PX }}
      className="flex shrink-0 items-stretch overflow-x-auto border-b border-[var(--bd)] bg-[var(--sb)]"
    >
      {tabs.map((tab) => (
        <TabItem key={tab.id} tab={tab} active={tab.id === current?.id} />
      ))}
      <ToolButton
        icon={ICONS.add}
        label={t('browser:tabs.new')}
        testId={T.newTab}
        className="mx-1 self-center"
        onClick={() => send(BrowserIpc.openTab, {})}
      />
    </div>
  )
}
