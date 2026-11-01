import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { TerminalTestIds } from '../../contract'
import { getWorkspace } from '../runtime'
import { PaneArea } from './PaneArea'
import { TabStrip } from './TabStrip'

function EmptyPanel() {
  const t = useT()
  return (
    <div
      data-testid={TerminalTestIds.empty}
      className="flex h-full items-center justify-center p-6 text-center text-[12px] text-mu"
    >
      {t('terminal:empty.noWorktree')}
    </div>
  )
}

/**
 * Right-panel `terminal` tab: the active worktree's tabs. Every tab of that worktree stays mounted (hidden ones with
 * `display:none`); another worktree's views unmount and re-attach from a snapshot when it is shown again.
 */
export function TerminalPanel() {
  const workspace = getWorkspace()
  const activeId = useStore(workspace.store, (s) => s.activeWorktreeId)
  const layout = useStore(workspace.store, (s) => (activeId ? s.layouts[activeId] : undefined))
  const searchRequest = useStore(workspace.store, (s) => s.searchRequest)
  useEffect(() => {
    if (activeId) void workspace.ensureLayout(activeId)
  }, [activeId, workspace])
  if (!activeId) return <EmptyPanel />
  return (
    <div data-testid={TerminalTestIds.panel} className="flex h-full min-h-0 flex-col bg-pn">
      {layout && <TabStrip layout={layout} />}
      <div className="relative min-h-0 flex-1">
        {layout?.tabs.map((tab) => (
          <div key={tab.id} className={cn('absolute inset-0', tab.id !== layout.activeTabId && 'hidden')}>
            <PaneArea tab={tab} searchRequest={tab.id === layout.activeTabId ? searchRequest : 0} />
          </div>
        ))}
      </div>
    </div>
  )
}
