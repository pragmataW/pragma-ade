import { useT } from '@pragma/sdk/renderer'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { TerminalTestIds } from '../../contract'
import { getWorkspace } from '../runtime'
import { TerminalView } from '../view/TerminalView'

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

/** Right-panel `terminal` tab: the active worktree's terminals. */
export function TerminalPanel() {
  const workspace = getWorkspace()
  const activeId = useStore(workspace.store, (s) => s.activeWorktreeId)
  const layout = useStore(workspace.store, (s) => (activeId ? s.layouts[activeId] : undefined))
  useEffect(() => {
    if (activeId) void workspace.ensureLayout(activeId)
  }, [activeId, workspace])
  if (!activeId) return <EmptyPanel />
  const tab = layout?.tabs.find((t) => t.id === layout.activeTabId)
  const pane = tab?.panes[0]
  return (
    <div data-testid={TerminalTestIds.panel} className="flex h-full min-h-0 flex-col bg-pn">
      {pane?.ptyId ? <TerminalView key={pane.ptyId} ptyId={pane.ptyId} autoFocus /> : null}
    </div>
  )
}
