import { create } from 'zustand'
import { LAST_SCOPE_STORAGE_KEY, VIEW_MODES } from '../constants'
import {
  BoardError,
  type BoardErrorCode,
  type BoardScope,
  BoardScopeSchema,
  type BoardSnapshot,
  boardIpc,
  type ColumnId,
  type ColumnPosition,
  type ColumnRef,
  type CreateTaskInput,
  errorMessage,
  type ProjectOption,
  SCOPE_KIND,
  type SessionStatusChangedEvent,
  type StartInNewWorktreeInput,
  type StartInWorktreeInput,
  type TaskDto,
  type TaskId,
  type TaskPosition,
  type UpdateTaskPatch,
} from '../contract'
import { resolveRank } from '../lib/rank'
import { call } from './lib/ipc'
import { EMPTY_FILTER, type UiFilter } from './model'

export type ViewMode = (typeof VIEW_MODES)[number]
export const VIEW_MODE = { board: VIEW_MODES[0], list: VIEW_MODES[1] } as const

export interface BoardState {
  scope: BoardScope | null
  snapshot: BoardSnapshot | null
  projects: ProjectOption[]
  filter: UiFilter
  mode: ViewMode
  selectedTaskId: TaskId | null
  error: string | null
  openCount: number
}

function readStoredScope(): BoardScope | null {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_SCOPE_STORAGE_KEY)
    const parsed = raw ? BoardScopeSchema.safeParse(JSON.parse(raw)) : null
    return parsed?.success ? parsed.data : null
  } catch {
    return null
  }
}

function storeScope(scope: BoardScope): void {
  try {
    globalThis.localStorage?.setItem(LAST_SCOPE_STORAGE_KEY, JSON.stringify(scope))
  } catch {
    // Per-viewer convenience only.
  }
}

export const scopeIncludes = (scope: BoardScope | null, projectIds: readonly string[]): boolean =>
  scope !== null && (scope.kind === SCOPE_KIND.all || projectIds.includes(scope.projectId))

/** A stored project scope is only reused while that project is still listed. */
const stillListed = (scope: BoardScope | null, projects: ProjectOption[]): scope is BoardScope =>
  scope !== null && (scope.kind === SCOPE_KIND.all || projects.some((p) => p.id === scope.projectId))

/** The snapshot with `task` moved (temporary key between its new neighbours) until the server answers. */
function withOptimisticMove(
  snapshot: BoardSnapshot,
  id: TaskId,
  column: ColumnId,
  position: TaskPosition | undefined,
): BoardSnapshot {
  const keyOf = (taskId: TaskId | undefined) => snapshot.tasks.find((t) => t.id === taskId)?.sortKey
  const keys = snapshot.tasks.filter((t) => t.columnId === column && t.id !== id).map((t) => t.sortKey)
  const afterKey = keyOf(position?.afterTaskId)
  const sortKey = resolveRank(keys, { afterKey, beforeKey: afterKey ? undefined : keyOf(position?.beforeTaskId) })
  return { ...snapshot, tasks: snapshot.tasks.map((t) => (t.id === id ? { ...t, columnId: column, sortKey } : t)) }
}

let refreshSeq = 0

export const useBoardStore = create<BoardState>(() => ({
  scope: null,
  snapshot: null,
  projects: [],
  filter: EMPTY_FILTER,
  mode: VIEW_MODE.board,
  selectedTaskId: null,
  error: null,
  openCount: 0,
}))

const set = useBoardStore.setState
const get = useBoardStore.getState

/** Refetches projects and the snapshot of the current scope (stale answers are dropped). */
export async function refresh(): Promise<void> {
  const seq = ++refreshSeq
  const projects = await call(boardIpc.listProjects, {})
  const scope = stillListed(get().scope, projects) ? get().scope : await call(boardIpc.resolveDefaultScope, {})
  if (!scope) return
  try {
    const snapshot = await call(boardIpc.getSnapshot, { scope })
    if (seq === refreshSeq) set({ projects, scope, snapshot })
  } catch (e) {
    if (seq === refreshSeq) set({ projects, error: errorMessage(e) })
  }
}

export async function refreshCount(): Promise<void> {
  const { open } = await call(boardIpc.openCount, { scope: { kind: SCOPE_KIND.all } })
  set({ openCount: open })
}

export async function setScope(scope: BoardScope): Promise<void> {
  storeScope(scope)
  set({ scope, selectedTaskId: null })
  await refresh()
}

/** `board.open`: a given project, else the last scope, else the active worktree's project. */
export async function openBoard(projectId?: string): Promise<void> {
  if (projectId) return setScope({ kind: SCOPE_KIND.project, projectId })
  if (!get().scope) set({ scope: readStoredScope() })
  await refresh()
}

export const setFilter = (patch: Partial<UiFilter>): void => set((s) => ({ filter: { ...s.filter, ...patch } }))
export const clearFilter = (): void => set({ filter: EMPTY_FILTER })
export const setMode = (mode: ViewMode): void => set({ mode })
export const select = (selectedTaskId: TaskId | null): void => set({ selectedTaskId })
export const setError = (error: string | null): void => set({ error })

export function patchSessionStatus(e: SessionStatusChangedEvent): void {
  const snapshot = get().snapshot
  if (!snapshot) return
  const tasks = snapshot.tasks.map((t) =>
    t.sessionIds.includes(e.sessionId)
      ? {
          ...t,
          sessions: t.sessions.map((s) =>
            s.sessionId === e.sessionId ? { ...s, status: e.status, turnCompleted: e.turnCompleted } : s,
          ),
        }
      : t,
  )
  set({ snapshot: { ...snapshot, tasks } })
}

/** Runs a mutation and refreshes afterwards, whatever the outcome. */
async function mutate<T>(p: Promise<T>): Promise<T> {
  try {
    return await p
  } finally {
    void refresh()
  }
}

export const boardActions = {
  createTask: (input: CreateTaskInput): Promise<TaskDto> => mutate(call(boardIpc.createTask, input)),
  updateTask: (id: TaskId, patch: UpdateTaskPatch): Promise<TaskDto> =>
    mutate(call(boardIpc.updateTask, { id, patch })),
  deleteTask: (id: TaskId): Promise<void> => mutate(call(boardIpc.deleteTask, { id })),
  async moveTask(id: TaskId, column: ColumnRef, position?: TaskPosition): Promise<TaskDto> {
    const before = get().snapshot
    if (before && typeof column === 'number') set({ snapshot: withOptimisticMove(before, id, column, position) })
    try {
      return await mutate(call(boardIpc.moveTask, { id, column, position }))
    } catch (e) {
      if (before) set({ snapshot: before })
      throw e
    }
  },
  createColumn: (projectId: string, name: string, position?: ColumnPosition) =>
    mutate(call(boardIpc.createColumn, { projectId, name, position })),
  renameColumn: (columnId: ColumnId, name: string) => mutate(call(boardIpc.renameColumn, { columnId, name })),
  moveColumn: (columnId: ColumnId, position: ColumnPosition) =>
    mutate(call(boardIpc.moveColumn, { columnId, position })),
  deleteColumn: (columnId: ColumnId, moveTasksTo?: ColumnId) =>
    mutate(call(boardIpc.deleteColumn, { columnId, moveTasksTo })),
  unlinkSession: (taskId: TaskId, sessionId: string) => mutate(call(boardIpc.unlinkSession, { taskId, sessionId })),
  prepareStart: (taskId: TaskId) => call(boardIpc.prepareStart, { taskId }),
  checkBranch: (projectId: string, branch: string) => call(boardIpc.checkBranch, { projectId, branch }),
  startInNewWorktree: (input: StartInNewWorktreeInput) => mutate(call(boardIpc.startInNewWorktree, input)),
  startInWorktree: (input: StartInWorktreeInput) => mutate(call(boardIpc.startInWorktree, input)),
}

/** Board errors with this code are shown inline by the caller (not in the banner). */
export const isBoardError = (e: unknown, code: BoardErrorCode): boolean => e instanceof BoardError && e.code === code
