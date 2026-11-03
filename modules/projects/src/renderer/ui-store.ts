import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ProjectsErrorDto } from '../contract'

/** The open folder-name dialog: `folderId: null` creates a folder (moving `worktreeId` in, if set). */
export interface FolderDialogState {
  projectId: string
  folderId: string | null
  name: string
  worktreeId: string | null
}

/** Renderer-only UI state shared by the sidebar, dialogs and commands. */
export interface UiState {
  /** The last sidebar-level error (add project, remove project…), dismissible. */
  error: ProjectsErrorDto | null
  /** Project whose "New worktree" dialog is open. */
  createFor: string | null
  /** Worktree whose remove dialog is open. */
  removeFor: string | null
  folderDialog: FolderDialogState | null
}
export type UiStore = StoreApi<UiState>

export const createUiStore = (): UiStore =>
  createStore<UiState>(() => ({ error: null, createFor: null, removeFor: null, folderDialog: null }))
