import * as vscode from 'vscode'
import { BridgeConnection } from './bridgeConnection'
import { createVscodeApi } from './vscodeApi'

let connection: BridgeConnection | undefined

/** Wiring only: the handlers live in their own files. */
export function activate(context: vscode.ExtensionContext): void {
  const api = createVscodeApi(vscode, context)
  const version = String((context.extension.packageJSON as { version?: string }).version)
  connection = new BridgeConnection(api, { extensionVersion: version })
  context.subscriptions.push({ dispose: () => connection?.dispose() })
  void connection
    .start({
      openFile: async () => undefined,
      setTheme: async () => undefined,
    })
    .catch((e: unknown) => api.log(String(e)))
}

export function deactivate(): void {
  connection?.dispose()
  connection = undefined
}
