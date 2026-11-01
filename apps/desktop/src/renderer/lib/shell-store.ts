import { createStore } from 'zustand/vanilla'

export interface ShellState {
  sidebarCollapsed: boolean
  rightCollapsed: boolean
  rightMaximized: boolean
  settingsOpen: boolean
  settingsPage: string | null
  paletteOpen: boolean
}

export const INITIAL_SHELL_STATE: ShellState = {
  sidebarCollapsed: false,
  rightCollapsed: false,
  rightMaximized: false,
  settingsOpen: false,
  settingsPage: null,
  paletteOpen: false,
}

/** Shell-only UI state (pane visibility, settings view, palette). Pane sizes live in `core.layout`. */
export const createShellStore = () => createStore<ShellState>(() => ({ ...INITIAL_SHELL_STATE }))
export type ShellStore = ReturnType<typeof createShellStore>
