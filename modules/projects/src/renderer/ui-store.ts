import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ProjectsErrorDto } from '../contract'

/** Renderer-only UI state shared by the sidebar, dialogs and commands. */
export interface UiState {
  /** The last sidebar-level error (add project, remove project…), dismissible. */
  error: ProjectsErrorDto | null
  /** Project whose "New worktree" dialog is open. */
  createFor: string | null
  /** Worktree whose remove dialog is open. */
  removeFor: string | null
}
export type UiStore = StoreApi<UiState>

export const createUiStore = (): UiStore =>
  createStore<UiState>(() => ({ error: null, createFor: null, removeFor: null }))
