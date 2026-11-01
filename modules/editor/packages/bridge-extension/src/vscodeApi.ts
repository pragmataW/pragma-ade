import type * as vscode from 'vscode'
import { LOG_CHANNEL } from './constants'

export interface GlobalStateLike {
  get<T>(k: string): T | undefined
  update(k: string, v: unknown): Promise<void>
}

/** The narrow port over `vscode` the handlers use (tests use a hand fake). */
export interface VscodeApi {
  env: Record<string, string | undefined>
  workspaceFolderPath(): string | undefined
  log(msg: string): void
  showInfo(msg: string): void
  showWarning(msg: string): void
  /** Opens the file, puts the cursor at (line-1, column-1) and reveals it in the centre. */
  openAndReveal(absPath: string, line?: number, column?: number): Promise<void>
  getGlobalConfig<T>(section: string, key: string): T | undefined
  /** `ConfigurationTarget.Global`. */
  updateGlobalConfig(section: string, key: string, value: unknown): Promise<void>
  globalState: GlobalStateLike
}

const zeroBased = (n: number | undefined): number => Math.max(0, (n ?? 1) - 1)

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
    async openAndReveal(absPath, line, column) {
      const doc = await vs.workspace.openTextDocument(vs.Uri.file(absPath))
      const pos = new vs.Position(zeroBased(line), zeroBased(column))
      const editor = await vs.window.showTextDocument(doc, { preview: false })
      editor.selection = new vs.Selection(pos, pos)
      editor.revealRange(new vs.Range(pos, pos), vs.TextEditorRevealType.InCenter)
    },
    getGlobalConfig: (section, key) => vs.workspace.getConfiguration(section).inspect(key)?.globalValue as never,
    updateGlobalConfig: async (section, key, value) => {
      await vs.workspace.getConfiguration(section).update(key, value, vs.ConfigurationTarget.Global)
    },
    globalState: {
      get: (k) => ctx.globalState.get(k),
      update: async (k, v) => {
        await ctx.globalState.update(k, v)
      },
    },
  }
}
