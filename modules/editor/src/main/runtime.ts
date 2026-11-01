import type { EditorLanguageStatus } from '../contract'
import type { EditorBridge } from './bridge/editorBridge'
import type { EditorServiceImpl } from './editorService'
import type { EditorInstaller } from './install/installer'
import type { ServerController } from './server/serverController'
import type { EditorUpstream } from './upstream'
import type { ViewManager } from './views/viewManager'

/** The active module's main-side objects (IPC, test hooks and `deactivate` read them). */
export interface EditorRuntime {
  service: EditorServiceImpl
  views: ViewManager
  server: ServerController
  installer: EditorInstaller
  bridge: EditorBridge
  up: EditorUpstream
  languageStatus: Map<string, EditorLanguageStatus>
  /** Starts install + server in the background and shows the active worktree once ready. */
  start(): Promise<void>
  markActivated(): void
}

let current: EditorRuntime | null = null

export class EditorNotActiveError extends Error {}

export const setEditorRuntime = (rt: EditorRuntime | null): void => {
  current = rt
}

export function getEditorRuntime(): EditorRuntime {
  if (!current) throw new EditorNotActiveError('editor module is not active')
  return current
}
