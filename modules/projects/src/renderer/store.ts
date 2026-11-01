import type { RendererContext } from '@pragma/sdk/renderer'
import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  type Project,
  type ProjectsSnapshot,
  projectsIpc,
  projectsIpcEvents,
  type StatusChangedPayload,
  type Worktree,
} from '../contract'

export type ProjectsState = ProjectsSnapshot & { hydrated: boolean }
export type ProjectsIpc = Pick<RendererContext['ipc'], 'invoke' | 'subscribe'>
export type ProjectsStore = StoreApi<ProjectsState>

export const EMPTY_PROJECTS_STATE: ProjectsState = {
  projects: [],
  worktrees: [],
  changedFiles: {},
  sync: {},
  projectErrors: {},
  activeWorktreeId: null,
  hydrated: false,
}

export const applySnapshot = (_state: ProjectsState, snap: ProjectsSnapshot): ProjectsState => ({
  ...snap,
  hydrated: true,
})

export const applyStatus = (state: ProjectsState, p: StatusChangedPayload): ProjectsState => ({
  ...state,
  changedFiles: { ...state.changedFiles, [p.worktreeId]: p.changedFiles },
  sync: { ...state.sync, [p.worktreeId]: { upstream: p.upstream, ahead: p.ahead, behind: p.behind } },
})

export const applySelected = (state: ProjectsState, p: { worktreeId: string | null }): ProjectsState => ({
  ...state,
  activeWorktreeId: p.worktreeId,
})

export const selectWorktreesOf = (s: ProjectsSnapshot, projectId: string): Worktree[] =>
  s.worktrees.filter((w) => w.projectId === projectId)

/**
 * Sidebar filter (case-insensitive substring): a project whose name matches keeps all its worktrees,
 * otherwise only worktrees whose branch matches. An empty query keeps everything.
 */
export function filterWorktrees(project: Project, worktrees: Worktree[], query: string): Worktree[] {
  const q = query.trim().toLowerCase()
  if (!q || project.name.toLowerCase().includes(q)) return worktrees
  return worktrees.filter((w) => (w.branch ?? '').toLowerCase().includes(q))
}

export const selectActiveWorktree = (s: ProjectsSnapshot): Worktree | null =>
  s.worktrees.find((w) => w.id === s.activeWorktreeId) ?? null

export function selectProjectOf(s: ProjectsSnapshot, worktreeId: string): Project | null {
  const w = s.worktrees.find((x) => x.id === worktreeId)
  return (w && s.projects.find((p) => p.id === w.projectId)) ?? null
}

type Reducer = (state: ProjectsState) => ProjectsState

/** Vanilla store hydrated from `projects.getState` and kept current by the three IPC events. */
export function createProjectsStore(ipc: ProjectsIpc) {
  const store = createStore<ProjectsState>(() => EMPTY_PROJECTS_STATE)
  const subscriptions: { dispose(): void }[] = []
  let buffer: Reducer[] | null = null
  const apply = (r: Reducer): void => {
    if (buffer) buffer.push(r)
    else store.setState(r(store.getState()), true)
  }
  return {
    store,
    /** Subscribes first (events are buffered), then hydrates and replays what arrived meanwhile. */
    async start(): Promise<void> {
      buffer = []
      subscriptions.push(
        ipc.subscribe(projectsIpcEvents.stateChanged, (snap) => apply((s) => applySnapshot(s, snap))),
        ipc.subscribe(projectsIpcEvents.statusChanged, (p) => apply((s) => applyStatus(s, p))),
        ipc.subscribe(projectsIpcEvents.selected, (p) => apply((s) => applySelected(s, p))),
      )
      const snap = await ipc.invoke(projectsIpc.getState, undefined)
      const pending = buffer
      buffer = null
      store.setState(
        pending.reduce((s, r) => r(s), applySnapshot(store.getState(), snap)),
        true,
      )
    },
    stop(): void {
      for (const s of subscriptions.splice(0)) s.dispose()
    },
  }
}
