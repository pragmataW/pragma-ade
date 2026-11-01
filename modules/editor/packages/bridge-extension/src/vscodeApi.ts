import type * as vscode from 'vscode'
import { LOG_CHANNEL } from './constants'

/** The narrow port over `vscode` the handlers use (tests use a hand fake). */
export interface VscodeApi {
  env: Record<string, string | undefined>
  workspaceFolderPath(): string | undefined
  log(msg: string): void
  showInfo(msg: string): void
  showWarning(msg: string): void
}

/** The only file (besides extension.ts) importing `vscode`. */
export function createVscodeApi(vs: typeof vscode, ctx: vscode.ExtensionContext): VscodeApi {
  const channel = vs.window.createOutputChannel(LOG_CHANNEL)
  ctx.subscriptions.push(channel)
  return {
    env: process.env,
    workspaceFolderPath: () => vs.workspace.workspaceFolders?.[0]?.uri.fsPath,
    log: (msg) => channel.appendLine(msg),
    showInfo: (msg) => void vs.window.showInformationMessage(msg),
    showWarning: (msg) => void vs.window.showWarningMessage(msg),
  }
}
