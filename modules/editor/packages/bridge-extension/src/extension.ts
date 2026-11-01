import * as vscode from 'vscode'
import { BridgeConnection } from './bridgeConnection'
import { applyFirstRunDefaults } from './defaults'
import { handleOpenFile } from './handlers/openFile'
import { applyTheme } from './handlers/theme'
import { createVscodeApi } from './vscodeApi'

let connection: BridgeConnection | undefined

/** Wiring only: the handlers live in their own files. */
export function activate(context: vscode.ExtensionContext): void {
  const api = createVscodeApi(vscode, context)
  const version = String((context.extension.packageJSON as { version?: string }).version)
  const conn = new BridgeConnection(api, { extensionVersion: version })
  connection = conn
  context.subscriptions.push({ dispose: () => conn.dispose() })
  void conn
    .start({
      openFile: (m) => handleOpenFile(api, conn.folderPath ?? '', m),
      setTheme: async (m) => {
        await applyFirstRunDefaults(api, m.themeName)
        await applyTheme(api, m)
      },
    })
    .catch((e: unknown) => api.log(String(e)))
}

export function deactivate(): void {
  connection?.dispose()
  connection = undefined
}
