import type { CommentContext } from '@pragma/module-comments/contract'
import { create } from 'zustand'
import { CHANGE_MODE, type ChangedFile, type ChangeMode } from '../contract'

/** What the panel shows for one worktree. */
export interface WorktreeView {
  mode: ChangeMode
  selectedPath: string | null
  /** Display order of the last reconciled list (to keep the selection's index when its file disappears). */
  order: string[]
  composer: CommentContext | null
}

const INITIAL_VIEW: WorktreeView = { mode: CHANGE_MODE.uncommitted, selectedPath: null, order: [], composer: null }

/**
 * Keeps `prev` while it is listed; otherwise the file now at its old index, else the last file, else null. Without a
 * previous selection (or one the old order did not know) the first file.
 */
export function reconcileSelection(prev: string | null, prevOrder: readonly string[], files: readonly ChangedFile[]) {
  const paths = files.map((f) => f.path)
  if (prev !== null && paths.includes(prev)) return prev
  const index = prev === null ? -1 : prevOrder.indexOf(prev)
  if (index < 0) return paths[0] ?? null
  return paths[index] ?? paths.at(-1) ?? null
}

/** `uncommitted` when the path has uncommitted changes, else `branch`; `current` while that list is unknown. */
export function revealMode(path: string, uncommittedPaths: readonly string[] | null, current: ChangeMode): ChangeMode {
  if (uncommittedPaths === null) return current
  return uncommittedPaths.includes(path) ? CHANGE_MODE.uncommitted : CHANGE_MODE.branch
}

export interface GitChangesState {
  views: Record<string, WorktreeView>
  setMode(worktreeId: string, mode: ChangeMode): void
  select(worktreeId: string, path: string | null): void
  /** `files` in display order. */
  reconcile(worktreeId: string, files: readonly ChangedFile[]): void
  reveal(worktreeId: string, path: string, uncommittedPaths: readonly string[] | null): void
  openComposer(worktreeId: string, context: CommentContext): void
  closeComposer(worktreeId: string): void
}

export const viewOf = (s: Pick<GitChangesState, 'views'>, worktreeId: string): WorktreeView =>
  s.views[worktreeId] ?? INITIAL_VIEW

export const useGitChangesStore = create<GitChangesState>()((set) => {
  const patch = (worktreeId: string, fn: (v: WorktreeView) => Partial<WorktreeView>) =>
    set((s) => {
      const view = viewOf(s, worktreeId)
      return { views: { ...s.views, [worktreeId]: { ...view, ...fn(view) } } }
    })
  return {
    views: {},
    setMode: (id, mode) => patch(id, (v) => (v.mode === mode ? {} : { mode, order: [], composer: null })),
    select: (id, path) => patch(id, (v) => (v.selectedPath === path ? {} : { selectedPath: path, composer: null })),
    reconcile: (id, files) =>
      patch(id, (v) => {
        const selectedPath = reconcileSelection(v.selectedPath, v.order, files)
        const order = files.map((f) => f.path)
        return { selectedPath, order, composer: selectedPath === v.selectedPath ? v.composer : null }
      }),
    reveal: (id, path, uncommittedPaths) =>
      patch(id, (v) => ({
        mode: revealMode(path, uncommittedPaths, v.mode),
        selectedPath: path,
        order: [],
        composer: null,
      })),
    openComposer: (id, context) => patch(id, () => ({ composer: context })),
    closeComposer: (id) => patch(id, () => ({ composer: null })),
  }
})

/** The view of one worktree (re-renders on change). */
export const useWorktreeView = (worktreeId: string): WorktreeView => useGitChangesStore((s) => viewOf(s, worktreeId))
