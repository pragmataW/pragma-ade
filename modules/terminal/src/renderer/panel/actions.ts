import { type SplitAction, terminalIpc } from '../../contract'
import { getRuntime, getWorkspace } from '../runtime'

/** Layout actions on the active worktree (and its active tab), shared by the tab strip and the commands. */
function active(): { worktreeId: string; tabId: string | null } | null {
  const { activeWorktreeId, layouts } = getWorkspace().store.getState()
  if (!activeWorktreeId) return null
  return { worktreeId: activeWorktreeId, tabId: layouts[activeWorktreeId]?.activeTabId ?? null }
}

const ignore = (): undefined => undefined

export function newTab(): void {
  const a = active()
  if (a) getRuntime().ipc.invoke(terminalIpc.tabCreate, { worktreeId: a.worktreeId }).catch(ignore)
}

export function closeTab(tabId = active()?.tabId): void {
  const a = active()
  if (a && tabId) getRuntime().ipc.invoke(terminalIpc.tabClose, { worktreeId: a.worktreeId, tabId }).catch(ignore)
}

export function activateTab(tabId: string): void {
  const a = active()
  if (a) getRuntime().ipc.invoke(terminalIpc.tabActivate, { worktreeId: a.worktreeId, tabId }).catch(ignore)
}

export function renameTab(tabId: string, title: string): void {
  const a = active()
  if (a) getRuntime().ipc.invoke(terminalIpc.tabRename, { worktreeId: a.worktreeId, tabId, title }).catch(ignore)
}

export function splitTab(direction: SplitAction, tabId = active()?.tabId): void {
  const a = active()
  if (a && tabId)
    getRuntime().ipc.invoke(terminalIpc.tabSplit, { worktreeId: a.worktreeId, tabId, direction }).catch(ignore)
}

export function closePane(tabId: string, paneId: string): void {
  const a = active()
  if (a) getRuntime().ipc.invoke(terminalIpc.paneClose, { worktreeId: a.worktreeId, tabId, paneId }).catch(ignore)
}
