import { create } from 'zustand'
import { TASKS_PANEL } from '../../../constants'
import { TASK_FILTER, type TaskFilter } from './model'

/** What one chat view's Tasks panel shows (kept in memory per session, so tab switches keep it). */
export interface TasksPanelView {
  open: boolean
  width: number
  /** The task in the detail view (null = the list). */
  selectedId: string | null
  filter: TaskFilter
  query: string
}

/** "Show in chat": the main transcript opens the cards on `path` and flashes `taskId`'s card (`nonce` per request). */
export interface TaskReveal {
  taskId: string
  path: readonly string[]
  nonce: number
}

export const DEFAULT_TASKS_VIEW: TasksPanelView = {
  open: false,
  width: TASKS_PANEL.defaultWidth,
  selectedId: null,
  filter: TASK_FILTER.all,
  query: '',
}

interface TasksPanelState {
  views: Record<string, TasksPanelView>
  /** Sessions whose chat UI renders a Tasks panel (`TaskCard` offers "Open in panel" only then). */
  mounted: Record<string, number>
  reveals: Record<string, TaskReveal | undefined>
  patch(sessionId: string, p: Partial<TasksPanelView>): void
  toggle(sessionId: string): void
  /** Opens the panel on a task's detail view. */
  openTask(sessionId: string, taskId: string): void
  /** Registers a mounted panel; returns its unregister. */
  mount(sessionId: string): () => void
  reveal(sessionId: string, taskId: string, path: readonly string[]): void
  /** Clears the reveal once handled (only the same request). */
  clearReveal(sessionId: string, nonce: number): void
}

const clampWidth = (w: number): number => Math.min(TASKS_PANEL.maxWidth, Math.max(TASKS_PANEL.minWidth, Math.round(w)))
let nonce = 0

export const useTasksPanelStore = create<TasksPanelState>((set, get) => {
  const viewOf = (sessionId: string): TasksPanelView => get().views[sessionId] ?? DEFAULT_TASKS_VIEW
  const patch = (sessionId: string, p: Partial<TasksPanelView>) =>
    set((s) => {
      const next = { ...viewOf(sessionId), ...p }
      return { views: { ...s.views, [sessionId]: { ...next, width: clampWidth(next.width) } } }
    })
  const count = (sessionId: string, by: number) =>
    set((s) => ({ mounted: { ...s.mounted, [sessionId]: Math.max(0, (s.mounted[sessionId] ?? 0) + by) } }))
  return {
    views: {},
    mounted: {},
    reveals: {},
    patch,
    toggle: (sessionId) => patch(sessionId, { open: !viewOf(sessionId).open }),
    openTask: (sessionId, taskId) => patch(sessionId, { open: true, selectedId: taskId }),
    mount(sessionId) {
      count(sessionId, 1)
      return () => count(sessionId, -1)
    },
    reveal: (sessionId, taskId, path) =>
      set((s) => ({ reveals: { ...s.reveals, [sessionId]: { taskId, path, nonce: ++nonce } } })),
    clearReveal: (sessionId, n) =>
      set((s) => (s.reveals[sessionId]?.nonce === n ? { reveals: { ...s.reveals, [sessionId]: undefined } } : s)),
  }
})

export const useTasksView = (sessionId: string): TasksPanelView =>
  useTasksPanelStore((s) => s.views[sessionId] ?? DEFAULT_TASKS_VIEW)
export const useTasksPanelMounted = (sessionId: string): boolean =>
  useTasksPanelStore((s) => (s.mounted[sessionId] ?? 0) > 0)

/** The Tasks shortcut / command: toggles the active chat's panel when its UI has one. */
export function toggleTasksPanel(sessionId: string | null): void {
  const state = useTasksPanelStore.getState()
  if (sessionId && (state.mounted[sessionId] ?? 0) > 0) state.toggle(sessionId)
}

/** Test reset. */
export const resetTasksPanels = (): void => useTasksPanelStore.setState({ views: {}, mounted: {}, reveals: {} })
