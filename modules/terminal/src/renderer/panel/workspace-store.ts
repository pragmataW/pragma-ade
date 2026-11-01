import { type ProjectsRendererService, ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import type { RendererContext } from '@pragma/sdk/renderer'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { type TerminalSettings, terminalIpc, terminalIpcEvents, type WorktreeTerminalLayout } from '../../contract'

export interface WorkspaceState {
  activeWorktreeId: string | null
  /** Layouts by worktree id, kept current by `terminal.layoutChanged`. */
  layouts: Record<string, WorktreeTerminalLayout>
  /** Worktrees whose terminals were shown at least once in this renderer. */
  visited: string[]
  /** Bumped by `terminal.focusSearch`; the active pane opens its find bar. */
  searchRequest: number
}

export interface Workspace {
  store: StoreApi<WorkspaceState>
  /** Loads the worktree's layout once; creates its first tab when it has none. */
  ensureLayout(worktreeId: string): Promise<void>
  dispose(): void
}

type Ctx = Pick<RendererContext<TerminalSettings>, 'ipc' | 'services'>

/** Renderer-side terminal workspace: the active worktree (from projects) and the layouts main keeps. */
export function createWorkspace(ctx: Ctx): Workspace {
  const projects: ProjectsRendererService = ctx.services.get(ProjectsRendererServiceToken)
  const activeId = () => projects.getActiveWorktree()?.id ?? null
  const store = createStore<WorkspaceState>(() => ({
    activeWorktreeId: activeId(),
    layouts: {},
    visited: [],
    searchRequest: 0,
  }))
  const setLayout = (layout: WorktreeTerminalLayout): void =>
    store.setState((s) => ({ layouts: { ...s.layouts, [layout.worktreeId]: layout } }))
  const offProjects = projects.subscribe(() => {
    const id = activeId()
    if (id !== store.getState().activeWorktreeId) store.setState({ activeWorktreeId: id })
  })
  const changed = ctx.ipc.subscribe(terminalIpcEvents.layoutChanged, setLayout)
  const loading = new Map<string, Promise<void>>()
  const load = async (worktreeId: string): Promise<void> => {
    let layout = await ctx.ipc.invoke(terminalIpc.layoutGet, { worktreeId })
    if (layout.tabs.length === 0) layout = await ctx.ipc.invoke(terminalIpc.tabCreate, { worktreeId })
    setLayout(layout)
  }
  return {
    store,
    ensureLayout(worktreeId) {
      const visited = store.getState().visited
      if (!visited.includes(worktreeId)) store.setState({ visited: [...visited, worktreeId] })
      const pending =
        loading.get(worktreeId) ??
        load(worktreeId).catch(() => {
          loading.delete(worktreeId) // retried on the next call
        })
      loading.set(worktreeId, pending)
      return pending
    },
    dispose() {
      offProjects()
      changed.dispose()
    },
  }
}
