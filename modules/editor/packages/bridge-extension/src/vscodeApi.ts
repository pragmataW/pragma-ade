import type * as vscode from 'vscode'
import {
  COMMENT_MESSAGES,
  LOG_CHANNEL,
  SEVERITIES,
  type Severity,
  TAB_KINDS,
  type TabKind,
  THREAD_CONTEXT,
} from './constants'
import { createGitPort, type GitPort } from './git'

export type { RevisionSide } from './git'

export interface GlobalStateLike {
  get<T>(k: string): T | undefined
  update(k: string, v: unknown): Promise<void>
}

export interface Disposable {
  dispose(): void
}

/** What the review controller needs from a VS Code comment thread. */
export interface ThreadLike {
  /** The Pragma thread id of a drawn review thread; undefined for a new comment being written. */
  id?: string
  uri: { scheme: string; fsPath: string }
  /** 0-based inclusive lines; undefined for a file-level thread. */
  range: { startLine: number; endLine: number } | undefined
  /** Appends a read-only comment (used for "Not sent"); the thread then offers only its discard action, no reply. */
  addComment(body: string, label: string): void
  dispose(): void
}

/** One comment of a drawn thread (root or reply). */
export interface ThreadCommentSpec {
  body: string
  author: string
  /** e.g. `Pending`. */
  label?: string
  /** Epoch ms. */
  timestamp: number
  /** `COMMENT_CONTEXT.*`. */
  contextValue: string
}

/** A stored review thread: root and replies, replyable, Resolved / Unresolved. */
export interface ThreadSpec {
  id: string
  /** Absolute file path. */
  path: string
  /** 0-based inclusive lines. */
  startLine: number
  endLine: number
  /** Header text, e.g. `L3 · Open`. */
  label: string
  comments: ThreadCommentSpec[]
  resolved: boolean
  /** `THREAD_CONTEXT.*`. */
  contextValue: string
}

/** A drawn thread, updated in place so a half-typed reply survives a push. */
export interface ThreadHandle extends Disposable {
  update(spec: ThreadSpec): void
}

export interface CommentControllerHandle extends Disposable {
  createThread(t: ThreadSpec): ThreadHandle
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

export interface DiagnosticInfo {
  severity: Severity
  message: string
  /** 1-based. */
  line: number
}

export interface TabInfo {
  label: string
  kind: TabKind
  viewType?: string
  /** Diff tabs: `Uri.toString()` of both sides. */
  original?: string
  modified?: string
}

/** The narrow port over `vscode` the handlers use (tests use a hand fake). */
export interface VscodeApi extends GitPort {
  env: Record<string, string | undefined>
  workspaceFolderPath(): string | undefined
  log(msg: string): void
  showInfo(msg: string): void
  showWarning(msg: string): void
  /** Opens the file, puts the cursor at (line-1, column-1) and reveals it in the centre. */
  openAndReveal(absPath: string, line?: number, column?: number): Promise<void>
  /** Cursor to (line-1, 0) of the active text editor (a diff's modified side), revealed in the centre. */
  revealInActiveEditor(line: number): void
  getGlobalConfig<T>(section: string, key: string): T | undefined
  /** `ConfigurationTarget.Global`. */
  updateGlobalConfig(section: string, key: string, value: unknown): Promise<void>
  globalState: GlobalStateLike
  createCommentController(spec: CommentControllerSpec): CommentControllerHandle
  /** The handler gets the command argument converted to `{ thread, text }` when it is a comment reply. */
  registerReplyCommand(id: string, handler: (reply: { thread: ThreadLike; text: string }) => unknown): Disposable
  /** Thread title actions: the handler gets the Pragma id of the thread the action was clicked on, and the thread. */
  registerThreadCommand(id: string, handler: (threadId: string | undefined, thread: ThreadLike) => unknown): Disposable
  /** Full text lines and language of a document. */
  readDocument(uri: ThreadLike['uri']): Promise<{ lines: string[]; languageId: string }>
  diagnostics(absPath: string): DiagnosticInfo[]
  executeCommand(id: string, args: unknown[]): Promise<unknown>
  tabs(): TabInfo[]
  extensionActive(id: string): boolean
  /** 1-based cursor of the active text editor. */
  activeEditor(): { path: string; line: number; column: number } | null
  activeDocument(): { languageId: string; path: string } | undefined
  onDidChangeActiveEditor(cb: () => void): Disposable
  onDidChangeDiagnostics(cb: () => void): Disposable
}

/** Drawn thread → its Pragma id (the comment commands get VS Code's thread object). */
const threadIds = new WeakMap<vscode.CommentThread, string>()

const toThread = (vs: typeof vscode, t: vscode.CommentThread, author: string): ThreadLike => ({
  id: threadIds.get(t),
  uri: { scheme: t.uri.scheme, fsPath: t.uri.fsPath },
  range: t.range ? { startLine: t.range.start.line, endLine: t.range.end.line } : undefined,
  addComment(body, label) {
    const comment: vscode.Comment = { body, label, mode: vs.CommentMode.Preview, author: { name: author } }
    t.comments = [...t.comments, comment]
    t.canReply = false
    t.contextValue = THREAD_CONTEXT.unsent
  },
  dispose: () => t.dispose(),
})

function tabInfo(vs: typeof vscode, tab: vscode.Tab): TabInfo {
  if (tab.input instanceof vs.TabInputText) return { label: tab.label, kind: TAB_KINDS.text }
  if (tab.input instanceof vs.TabInputTextDiff)
    return {
      label: tab.label,
      kind: TAB_KINDS.diff,
      original: tab.input.original.toString(),
      modified: tab.input.modified.toString(),
    }
  if (tab.input instanceof vs.TabInputWebview)
    return { label: tab.label, kind: TAB_KINDS.webview, viewType: tab.input.viewType }
  return { label: tab.label, kind: TAB_KINDS.other }
}

const zeroBased = (n: number | undefined): number => Math.max(0, (n ?? 1) - 1)

const toComments = (vs: typeof vscode, spec: ThreadSpec): vscode.Comment[] =>
  spec.comments.map((c) => ({
    body: c.body,
    label: c.label,
    mode: vs.CommentMode.Preview,
    author: { name: c.author },
    timestamp: new Date(c.timestamp),
    contextValue: c.contextValue,
  }))

/** Writes everything but the uri; the collapse follows a status change only (the user's own toggle stays). */
function applySpec(vs: typeof vscode, t: vscode.CommentThread, spec: ThreadSpec, statusChanged: boolean): void {
  t.comments = toComments(vs, spec)
  t.label = spec.label
  t.range = new vs.Range(spec.startLine, 0, spec.endLine, 0)
  t.contextValue = spec.contextValue
  t.state = spec.resolved ? vs.CommentThreadState.Resolved : vs.CommentThreadState.Unresolved
  if (statusChanged)
    t.collapsibleState = spec.resolved
      ? vs.CommentThreadCollapsibleState.Collapsed
      : vs.CommentThreadCollapsibleState.Expanded
}

function drawThread(vs: typeof vscode, c: vscode.CommentController, spec: ThreadSpec): ThreadHandle {
  const thread = c.createCommentThread(vs.Uri.file(spec.path), new vs.Range(spec.startLine, 0, spec.endLine, 0), [])
  thread.canReply = true
  threadIds.set(thread, spec.id)
  applySpec(vs, thread, spec, true)
  let resolved = spec.resolved
  return {
    update(next) {
      applySpec(vs, thread, next, next.resolved !== resolved)
      resolved = next.resolved
    },
    dispose: () => thread.dispose(),
  }
}

function reveal(vs: typeof vscode, editor: vscode.TextEditor, line?: number, column?: number): void {
  const pos = new vs.Position(zeroBased(line), zeroBased(column))
  editor.selection = new vs.Selection(pos, pos)
  editor.revealRange(new vs.Range(pos, pos), vs.TextEditorRevealType.InCenter)
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
    async openAndReveal(absPath, line, column) {
      const doc = await vs.workspace.openTextDocument(vs.Uri.file(absPath))
      reveal(vs, await vs.window.showTextDocument(doc, { preview: false }), line, column)
    },
    revealInActiveEditor(line) {
      const editor = vs.window.activeTextEditor
      if (editor) reveal(vs, editor, line)
    },
    ...createGitPort(vs),
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
      return { dispose: () => c.dispose(), createThread: (t) => drawThread(vs, c, t) }
    },
    registerReplyCommand: (id, handler) =>
      vs.commands.registerCommand(id, (reply: vscode.CommentReply) =>
        handler({ thread: toThread(vs, reply.thread, COMMENT_MESSAGES.author), text: reply.text }),
      ),
    registerThreadCommand: (id, handler) =>
      vs.commands.registerCommand(id, (thread: vscode.CommentThread) =>
        handler(threadIds.get(thread), toThread(vs, thread, COMMENT_MESSAGES.author)),
      ),
    async readDocument(uri) {
      const doc = await vs.workspace.openTextDocument(vs.Uri.file(uri.fsPath))
      return { lines: doc.getText().split(/\r?\n/), languageId: doc.languageId }
    },
    diagnostics: (absPath) =>
      vs.languages.getDiagnostics(vs.Uri.file(absPath)).map((d) => ({
        severity: SEVERITIES[d.severity] ?? SEVERITIES[0],
        message: d.message,
        line: d.range.start.line + 1,
      })),
    executeCommand: (id, args) => Promise.resolve(vs.commands.executeCommand(id, ...args)),
    tabs: () => vs.window.tabGroups.all.flatMap((g) => g.tabs.map((t) => tabInfo(vs, t))),
    extensionActive: (id) => vs.extensions.getExtension(id)?.isActive ?? false,
    activeEditor() {
      const e = vs.window.activeTextEditor
      if (!e) return null
      const p = e.selection.active
      return { path: e.document.uri.fsPath, line: p.line + 1, column: p.character + 1 }
    },
    activeDocument() {
      const d = vs.window.activeTextEditor?.document
      return d ? { languageId: d.languageId, path: d.uri.fsPath } : undefined
    },
    onDidChangeActiveEditor: (cb) => vs.window.onDidChangeActiveTextEditor(() => cb()),
    onDidChangeDiagnostics: (cb) => vs.languages.onDidChangeDiagnostics(() => cb()),
  }
}
