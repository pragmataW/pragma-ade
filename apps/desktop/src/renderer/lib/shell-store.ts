import { createStore } from 'zustand/vanilla'
import { DEFAULT_DOCK_LAYOUT, type DockLayout } from './dock-layout'

export interface ShellState extends DockLayout {
  sidebarCollapsed: boolean
  rightCollapsed: boolean
  rightMaximized: boolean
  settingsOpen: boolean
  settingsPage: string | null
  paletteOpen: boolean
  /** The dock is being dragged to a new position (drop zones are shown). */
  dockDragging: boolean
}

export const INITIAL_SHELL_STATE: ShellState = {
  sidebarCollapsed: false,
  rightCollapsed: false,
  rightMaximized: false,
  settingsOpen: false,
  settingsPage: null,
  paletteOpen: false,
  dockDragging: false,
  ...DEFAULT_DOCK_LAYOUT,
}

/** Shell-only UI state (pane visibility, dock position, settings view, palette). Pane sizes live in `core.layout`. */
export const createShellStore = (dock: DockLayout = DEFAULT_DOCK_LAYOUT) =>
  createStore<ShellState>(() => ({ ...INITIAL_SHELL_STATE, ...dock }))
export type ShellStore = ReturnType<typeof createShellStore>
