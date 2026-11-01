import type * as vscode from 'vscode'
import { COMMENT_MESSAGES, LOG_CHANNEL } from './constants'

export interface GlobalStateLike {
  get<T>(k: string): T | undefined
  update(k: string, v: unknown): Promise<void>
}

export interface Disposable {
  dispose(): void
}

/** What the review controller needs from a VS Code comment thread. */
export interface ThreadLike {
  uri: { scheme: string; fsPath: string }
  /** 0-based inclusive lines; undefined for a file-level thread. */
  range: { startLine: number; endLine: number } | undefined
  /** Appends a read-only comment (used for "Not sent"). */
  addComment(body: string, label: string): void
  dispose(): void
}

export interface DocumentInfo {
  scheme: string
  fsPath: string
  lineCount: number
}

export interface CommentControllerSpec {
  id: string
  label: string
  placeHolder: string
  prompt: string
  /** 0-based inclusive line ranges where commenting is offered. */
  ranges(doc: DocumentInfo): [number, number][]
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
  createCommentController(spec: CommentControllerSpec): Disposable
  /** The handler gets the command argument converted to `{ thread, text }` when it is a comment reply. */
  registerReplyCommand(id: string, handler: (reply: { thread: ThreadLike; text: string }) => unknown): Disposable
  /** Full text lines and language of a document. */
  readDocument(uri: ThreadLike['uri']): Promise<{ lines: string[]; languageId: string }>
}

const toThread = (vs: typeof vscode, t: vscode.CommentThread, author: string): ThreadLike => ({
  uri: { scheme: t.uri.scheme, fsPath: t.uri.fsPath },
  range: t.range ? { startLine: t.range.start.line, endLine: t.range.end.line } : undefined,
  addComment(body, label) {
    const comment: vscode.Comment = { body, label, mode: vs.CommentMode.Preview, author: { name: author } }
    t.comments = [...t.comments, comment]
  },
  dispose: () => t.dispose(),
})

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
    createCommentController(spec) {
      const c = vs.comments.createCommentController(spec.id, spec.label)
      c.options = { placeHolder: spec.placeHolder, prompt: spec.prompt }
      c.commentingRangeProvider = {
        provideCommentingRanges: (doc) =>
          spec
            .ranges({ scheme: doc.uri.scheme, fsPath: doc.uri.fsPath, lineCount: doc.lineCount })
            .map(([a, b]) => new vs.Range(a, 0, b, 0)),
      }
      return c
    },
    registerReplyCommand: (id, handler) =>
      vs.commands.registerCommand(id, (reply: vscode.CommentReply) =>
        handler({ thread: toThread(vs, reply.thread, COMMENT_MESSAGES.author), text: reply.text }),
      ),
    async readDocument(uri) {
      const doc = await vs.workspace.openTextDocument(vs.Uri.file(uri.fsPath))
      return { lines: doc.getText().split(/\r?\n/), languageId: doc.languageId }
    },
  }
}
