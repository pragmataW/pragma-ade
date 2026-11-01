import { CoreIpc, type Rect, ShellTestIds as T } from '@pragma/sdk'
import { ErrorBoundary, type RightTab, useRendererHost } from '@pragma/sdk/renderer'
import { useCallback, useRef } from 'react'
import { useStore } from 'zustand'
import { useShell } from '../lib/shell-context'
import { useElementBounds } from '../lib/use-element-bounds'
import { EmptyState } from './EmptyState'
import { RightTabStrip } from './RightTabStrip'

/** One tab body; reports its rect for native views only while it is the visible tab (§10.2). */
function TabContent({ tab, visible }: { tab: RightTab; visible: boolean }) {
  const host = useRendererHost()
  const ref = useRef<HTMLDivElement>(null)
  const report = useCallback(
    (bounds: Rect | null) => void host.ipc.invoke(CoreIpc.nativeViewsBounds, { panelTabId: tab.id, bounds }),
    [host, tab.id],
  )
  useElementBounds(ref, visible, report)
  return (
    <div ref={ref} data-testid={T.rightTabContent(tab.id)} hidden={!visible} className="h-full min-h-0">
      <ErrorBoundary name={`tab ${tab.id}`}>
        <tab.component tabId={tab.id} />
      </ErrorBoundary>
    </div>
  )
}

export function RightPanel() {
  const host = useRendererHost()
  const { tabs, activeTab } = useStore(host.registries.store)
  const hidden = useShell((s) => s.rightCollapsed || s.settingsOpen)
  return (
    <div className="flex h-full flex-col bg-[var(--pn)]">
      <RightTabStrip />
      <div className="min-h-0 flex-1">
        {tabs.length === 0 && <EmptyState textKey="core:right.welcome" testId={T.rightPanelWelcome} />}
        {tabs.map((tab) => (
          <TabContent key={tab.id} tab={tab} visible={!hidden && tab.id === activeTab} />
        ))}
      </div>
    </div>
  )
}
