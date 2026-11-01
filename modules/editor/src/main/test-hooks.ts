import { defineTestHooks, type MainContext } from '@pragma/sdk/main'
import type { WebContentsView } from 'electron'
import { SHORTCUT_SCOPE_GLOBAL, TEST_GLOBAL_ACCELERATOR, TEST_HOOKS_GLOBAL, TEST_PROBE } from '../constants'
import { type EditorStatus, normalizeFolderKey, type OpenFileArgs, type OpenFileResult, type TestOp } from '../contract'
import { getEditorRuntime } from './runtime'
import type { ServerInfo } from './server/serverController'

/** `globalThis.__pragmaEditorTest`, installed only when `PRAGMA_TEST=1` (§8). */
export interface EditorTestHooks {
  status(): EditorStatus
  /** Runs a bridge-extension test op in the worktree's workbench. */
  request(worktreeId: string, op: TestOp, args?: unknown): Promise<unknown>
  openViews(): { worktreeId: string; webContentsId: number; shown: boolean }[]
  viewBounds(
    worktreeId: string,
  ): { bounds: { x: number; y: number; width: number; height: number }; visible: boolean } | null
  serverInfo(): ServerInfo
  evalInWorkbench(worktreeId: string, js: string): Promise<unknown>
  openFile(args: OpenFileArgs): Promise<OpenFileResult>
  probeHits(): number
}
export type EditorTestGlobal = { [TEST_HOOKS_GLOBAL]: EditorTestHooks }

export class NoEditorViewError extends Error {}

const native = (worktreeId: string): WebContentsView => {
  const view = getEditorRuntime().views.view(worktreeId)
  if (!view) throw new NoEditorViewError(`no editor view for ${worktreeId}`)
  return view as unknown as WebContentsView
}

export function createEditorTestHooks(ctx: MainContext): EditorTestHooks {
  let hits = 0
  ctx.commands.register(TEST_PROBE.command, () => {
    hits++
  })
  ctx.shortcuts.register({
    id: TEST_PROBE.shortcutId,
    accelerator: TEST_GLOBAL_ACCELERATOR,
    scope: SHORTCUT_SCOPE_GLOBAL,
    command: TEST_PROBE.command,
  })
  return {
    status: () => getEditorRuntime().server.status(),
    async request(worktreeId, op, args) {
      const rt = getEditorRuntime()
      const wt = await rt.up.getWorktree(worktreeId)
      if (!wt) throw new NoEditorViewError(`unknown worktree ${worktreeId}`)
      return rt.bridge.testRequest(normalizeFolderKey(wt.path), op, args)
    },
    openViews: () => getEditorRuntime().views.openViews(),
    viewBounds(worktreeId) {
      const view = getEditorRuntime().views.view(worktreeId)
      if (!view) return null
      const v = view as unknown as WebContentsView
      return { bounds: v.getBounds(), visible: v.getVisible() }
    },
    serverInfo: () => getEditorRuntime().server.info(),
    evalInWorkbench: (worktreeId, js) => native(worktreeId).webContents.executeJavaScript(js, true),
    openFile: (args) => getEditorRuntime().service.openFile(args),
    probeHits: () => hits,
  }
}

export default defineTestHooks((ctx) => {
  ;(globalThis as unknown as EditorTestGlobal)[TEST_HOOKS_GLOBAL] = createEditorTestHooks(ctx)
})
