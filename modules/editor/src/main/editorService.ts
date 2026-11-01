import {
  EDITOR_ERROR,
  EDITOR_STATE,
  type EditorService,
  type EditorSettings,
  type EditorStatus,
  editorErrorI18nKey,
  normalizeFolderKey,
  type OpenFileArgs,
  type OpenFileResult,
  type ThemeMode,
  type ThemePalette,
} from '../contract'
import type { EditorBridge } from './bridge/editorBridge'
import type { ServerController } from './server/serverController'
import type { EditorUpstream } from './upstream'
import type { ViewManager } from './views/viewManager'

export type { ServerController }

export interface EditorServiceDeps {
  server: ServerController
  views: Pick<ViewManager, 'show'>
  bridge: Pick<EditorBridge, 'openFile' | 'pushTheme'>
  up: Pick<EditorUpstream, 'getWorktree' | 'getActiveWorktreeId' | 'selectWorktree'>
  settings: () => EditorSettings
  /** `ctx.ipc.publish(revealRequested)`; the renderer activates the Files tab. */
  publishReveal(worktreeId: string): void
  /** The Files tab was used this session (views follow worktree selection from now on). */
  markActivated(): void
  log?: (msg: string, error?: unknown) => void
}

const OPEN_FAILED = editorErrorI18nKey(EDITOR_ERROR.openFileFailed)
const NOT_FOUND = editorErrorI18nKey(EDITOR_ERROR.worktreeNotFound)

export class NotReadyError extends Error {}

/** `EditorServiceToken` implementation. */
export class EditorServiceImpl implements EditorService {
  readonly #d: EditorServiceDeps

  constructor(d: EditorServiceDeps) {
    this.#d = d
  }

  getStatus(): EditorStatus {
    return this.#d.server.status()
  }

  /** Starts the server if needed, selects the worktree, shows its view, reveals the Files tab, opens the file. */
  async openFile(args: OpenFileArgs): Promise<OpenFileResult> {
    const d = this.#d
    const wt = await d.up.getWorktree(args.worktreeId)
    if (!wt) return { ok: false, errorKey: NOT_FOUND }
    try {
      const status = await d.server.ensureRunning()
      if (status.state !== EDITOR_STATE.ready) throw new NotReadyError(status.state)
      d.markActivated()
      if (d.up.getActiveWorktreeId() !== wt.id) await d.up.selectWorktree(wt.id)
      d.views.show(wt)
      d.publishReveal(wt.id)
      await d.bridge.openFile(normalizeFolderKey(wt.path), {
        path: args.path,
        ...(args.line ? { line: args.line } : {}),
        ...(args.column ? { column: args.column } : {}),
      })
      return { ok: true }
    } catch (error) {
      d.log?.(`editor.openFile ${args.path} failed`, error)
      return { ok: false, errorKey: OPEN_FAILED }
    }
  }

  async setTheme(mode: ThemeMode, palette?: ThemePalette): Promise<void> {
    const map = this.#d.settings().themeMap
    this.#d.bridge.pushTheme({ themeName: map[mode], mode, ...(palette ? { colors: palette } : {}) })
  }
}
