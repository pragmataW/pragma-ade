import type { EditorSetThemeMsg } from '@pragma/module-editor/contract'
import * as vscode from 'vscode'
import { BridgeConnection, type EditorEventHandlers } from './bridgeConnection'
import { ReviewController } from './comments/controller'
import { CONNECTION, TEST_MODE } from './constants'
import { applyFirstRunDefaults } from './defaults'
import { handleOpenDiff } from './handlers/openDiff'
import { handleOpenFile } from './handlers/openFile'
import { applyTheme, newerThemesOnly } from './handlers/theme'
import { startLanguageStatusReporter } from './languageStatus'
import { LatestQueue } from './latestQueue'
import { answerTestRequest, createTestOps } from './testOps'
import { createVscodeApi, type VscodeApi } from './vscodeApi'

let connection: BridgeConnection | undefined

function handlers(api: VscodeApi, conn: BridgeConnection, review: ReviewController): EditorEventHandlers {
  const folderPath = (): string => conn.folderPath ?? ''
  const ops = createTestOps(api, {
    folderPath,
    handleComment: (r, a) => review.handle(r, a),
    handleReply: (r, send) => review.handleReply(r, send),
    setStatus: (id, status) => review.setStatus(id, status),
    threads: () => review.threads(),
  })
  // One apply at a time, only the newest waiting theme (hello reply and broadcasts share the queue).
  const themes = new LatestQueue<EditorSetThemeMsg>(
    async (m) => {
      await applyFirstRunDefaults(api, m.themeName)
      await applyTheme(api, m)
    },
    (e) => api.log(String(e)),
  )
  const fresh = newerThemesOnly()
  return {
    openFile: (m) => handleOpenFile(api, folderPath(), m),
    openDiff: (m) => handleOpenDiff(api, folderPath(), m),
    setTheme: async (m) => {
      if (fresh(m)) await themes.push(m)
    },
    threads: async (m) => review.showThreads(m.threads),
    ready: () => review.refresh(),
    ...(api.env[TEST_MODE.env] === TEST_MODE.enabled ? { testRequest: (m) => answerTestRequest(ops, conn, m) } : {}),
  }
}

/** Wiring only: the handlers live in their own files. */
export function activate(context: vscode.ExtensionContext): void {
  const api = createVscodeApi(vscode, context)
  const version = String((context.extension.packageJSON as { version?: string }).version)
  const conn = new BridgeConnection(api, { extensionVersion: version })
  const review = new ReviewController(api, conn)
  connection = conn
  context.subscriptions.push({ dispose: () => conn.dispose() })
  void conn
    .start(handlers(api, conn, review))
    .then((state) => {
      if (state !== CONNECTION.connected) return
      review.register()
      context.subscriptions.push(review, startLanguageStatusReporter(api, conn))
    })
    .catch((e: unknown) => api.log(String(e)))
}

export function deactivate(): void {
  connection?.dispose()
  connection = undefined
}
