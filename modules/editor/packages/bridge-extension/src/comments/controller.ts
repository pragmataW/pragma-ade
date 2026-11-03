import {
  COMMENT_ACTION,
  COMMENT_REPLY,
  type CommentAction,
  type EditorCommentReply,
  type EditorThread,
  THREAD_STATUS,
  type ThreadStatus,
} from '@pragma/module-editor/contract'
import type { BridgeConnection } from '../bridgeConnection'
import { COMMANDS, CONTROLLER, FILE_SCHEME, COMMENT_MESSAGES as M, THREADS_MESSAGE } from '../constants'
import { isInsideFolder } from '../handlers/openFile'
import type {
  CommentControllerHandle,
  Disposable,
  DocumentInfo,
  ThreadHandle,
  ThreadLike,
  ThreadSpec,
  VscodeApi,
} from '../vscodeApi'
import { buildCommentPayload } from './payload'
import { type ThreadInfo, toThreadInfo, toThreadSpec } from './threads'

export type ReplyLike = { thread: ThreadLike; text: string }
export type CommentConnection = Pick<BridgeConnection, 'folderPath' | 'request'>
type Drawn = { thread: EditorThread; spec: ThreadSpec; handle: ThreadHandle }

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Info message for a successful reply; null for `failed`. */
function successMessage(reply: EditorCommentReply): string | null {
  switch (reply.status) {
    case COMMENT_REPLY.drafted:
      return M.drafted
    case COMMENT_REPLY.sent:
      return M.sent
    case COMMENT_REPLY.needsUserAction:
      return M.needsUserAction
    case COMMENT_REPLY.failed:
      return null
    default: {
      const never: never = reply
      return never
    }
  }
}

const sameSpec = (a: ThreadSpec, b: ThreadSpec): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * The `pragma-review` comment controller: every line of worktree files, Send to Agent / Add to Review / Cancel for a
 * new comment, and the worktree's review threads (editor and new-side diff comments, the same threads Git Changes and
 * the drawer show) with replies, Reply / Reply and Send, Resolve / Reopen / Delete.
 */
export class ReviewController {
  readonly #api: VscodeApi
  readonly #conn: CommentConnection
  #disposables: Disposable[] = []
  #controller: CommentControllerHandle | undefined
  /** The latest thread list; drawn once the controller exists. */
  #wanted: EditorThread[] = []
  readonly #drawn = new Map<string, Drawn>()

  constructor(api: VscodeApi, conn: CommentConnection) {
    this.#api = api
    this.#conn = conn
  }

  /** Whole file for `file` documents inside the workspace folder, nothing elsewhere. */
  ranges(doc: DocumentInfo): [number, number][] {
    const folder = this.#conn.folderPath ?? this.#api.workspaceFolderPath()
    if (doc.scheme !== FILE_SCHEME || !folder || !isInsideFolder(folder, doc.fsPath)) return []
    return [[0, Math.max(0, doc.lineCount - 1)]]
  }

  register(): void {
    const api = this.#api
    this.#controller = api.createCommentController({ ...CONTROLLER, ranges: (doc) => this.ranges(doc) })
    this.#disposables.push(
      this.#controller,
      api.registerReplyCommand(COMMANDS.sendToAgent, (r) => this.handle(r, COMMENT_ACTION.send)),
      api.registerReplyCommand(COMMANDS.addToReview, (r) => this.handle(r, COMMENT_ACTION.draft)),
      api.registerReplyCommand(COMMANDS.cancel, (r) => r.thread.dispose()),
      api.registerReplyCommand(COMMANDS.reply, (r) => this.handleReply(r, false)),
      api.registerReplyCommand(COMMANDS.replyAndSend, (r) => this.handleReply(r, true)),
      api.registerThreadCommand(COMMANDS.resolve, (id) => this.setStatus(id, THREAD_STATUS.resolved)),
      api.registerThreadCommand(COMMANDS.reopen, (id) => this.setStatus(id, THREAD_STATUS.open)),
      api.registerThreadCommand(COMMANDS.deleteThread, (id) => this.deleteThread(id)),
    )
    this.#draw()
  }

  dispose(): void {
    this.#wanted = []
    this.#draw()
    this.#controller = undefined
    for (const d of this.#disposables.splice(0)) d.dispose()
  }

  /** Replaces the shown threads: gone ones disappear, changed ones are updated in place, unchanged ones stay. */
  showThreads(threads: readonly EditorThread[]): void {
    this.#wanted = [...threads]
    this.#draw()
  }

  /** Pulls the worktree's threads from the app (after every hello); a failure keeps what is shown. */
  async refresh(): Promise<void> {
    try {
      this.showThreads((await this.#conn.request(THREADS_MESSAGE, {})).threads)
    } catch (error) {
      this.#api.log(errorText(error))
    }
  }

  threads(): ThreadInfo[] {
    return [...this.#drawn.values()].map((d) => toThreadInfo(d.thread))
  }

  #draw(): void {
    const controller = this.#controller
    if (!controller) return
    const folder = this.#conn.folderPath ?? this.#api.workspaceFolderPath() ?? ''
    const wanted = new Map(this.#wanted.map((t) => [t.id, t]))
    for (const [id, drawn] of this.#drawn) {
      const next = wanted.get(id)
      if (next && toThreadSpec(folder, next).path === drawn.spec.path) continue
      drawn.handle.dispose()
      this.#drawn.delete(id)
    }
    for (const thread of wanted.values()) this.#drawOne(controller, folder, thread)
  }

  #drawOne(controller: CommentControllerHandle, folder: string, thread: EditorThread): void {
    const spec = toThreadSpec(folder, thread)
    const drawn = this.#drawn.get(thread.id)
    if (!drawn) {
      this.#drawn.set(thread.id, { thread, spec, handle: controller.createThread(spec) })
      return
    }
    if (!sameSpec(spec, drawn.spec)) drawn.handle.update(spec)
    this.#drawn.set(thread.id, { ...drawn, thread, spec })
  }

  /** Reply (and Send) in a stored thread's reply box. */
  async handleReply(reply: ReplyLike, send: boolean): Promise<void> {
    const threadId = reply.thread.id
    if (!threadId) {
      this.#api.showWarning(M.notStored)
      return
    }
    let result: EditorCommentReply
    try {
      result = await this.#conn.request('reply', { threadId, body: reply.text, send })
    } catch (error) {
      result = { status: COMMENT_REPLY.failed, message: errorText(error) }
    }
    if (result.status === COMMENT_REPLY.failed) this.#api.showWarning(result.message)
    else this.#api.showInfo(result.status === COMMENT_REPLY.drafted ? M.replied : (successMessage(result) ?? M.replied))
  }

  async setStatus(threadId: string | undefined, status: ThreadStatus): Promise<void> {
    await this.#threadRequest(threadId, () => this.#conn.request('setStatus', { threadId: threadId as string, status }))
  }

  async deleteThread(threadId: string | undefined): Promise<void> {
    await this.#threadRequest(threadId, () => this.#conn.request('deleteThread', { threadId: threadId as string }))
  }

  /** The app pushes the new thread list after the change; a failure is shown as a warning. */
  async #threadRequest(threadId: string | undefined, run: () => Promise<unknown>): Promise<void> {
    if (!threadId) {
      this.#api.showWarning(M.notStored)
      return
    }
    try {
      await run()
    } catch (error) {
      this.#api.showWarning(errorText(error))
    }
  }

  async handle(reply: ReplyLike, action: CommentAction): Promise<void> {
    const { thread, text } = reply
    const folderPath = this.#conn.folderPath ?? this.#api.workspaceFolderPath() ?? ''
    const doc = await this.#api.readDocument(thread.uri)
    const range = thread.range ?? { startLine: 0, endLine: 0 }
    const built = buildCommentPayload({
      folderPath,
      docPath: thread.uri.fsPath,
      docScheme: thread.uri.scheme,
      startLine0: range.startLine,
      endLine0: range.endLine,
      lineTexts: doc.lines,
      languageId: doc.languageId,
      body: text,
      action,
    })
    if (!built.ok) {
      this.#api.showWarning(built.message)
      return
    }
    let result: EditorCommentReply
    try {
      result = await this.#conn.request('comment', built.payload)
    } catch (error) {
      result = { status: COMMENT_REPLY.failed, message: errorText(error) }
    }
    const info = successMessage(result)
    if (info) {
      this.#api.showInfo(info)
      thread.dispose()
      return
    }
    if (result.status === COMMENT_REPLY.failed) {
      this.#api.showWarning(result.message)
      // The comment was stored: its Pending thread shows it, so the composer goes.
      if (result.commentId) {
        thread.dispose()
        return
      }
    }
    thread.addComment(text, M.notSentLabel)
  }
}
