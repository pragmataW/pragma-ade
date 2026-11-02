import { join } from 'node:path'
import {
  COMMENT_ACTION,
  COMMENT_REPLY,
  type CommentAction,
  type EditorCommentReply,
  type EditorDraft,
} from '@pragma/module-editor/contract'
import type { BridgeConnection } from '../bridgeConnection'
import { COMMANDS, CONTROLLER, DRAFTS_MESSAGE, FILE_SCHEME, COMMENT_MESSAGES as M } from '../constants'
import { isInsideFolder } from '../handlers/openFile'
import type { CommentControllerHandle, Disposable, DocumentInfo, ThreadLike, VscodeApi } from '../vscodeApi'
import { buildCommentPayload } from './payload'

export type ReplyLike = { thread: ThreadLike; text: string }
/** A drawn draft thread (`draftThreads` test op): worktree-relative path, 0-based lines. */
export type DraftThreadInfo = { id: string; path: string; startLine: number; endLine: number; body: string }
export type CommentConnection = Pick<BridgeConnection, 'folderPath' | 'request'>

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

const toInfo = (d: EditorDraft): DraftThreadInfo => ({
  id: d.id,
  path: d.filePath,
  startLine: d.lineStart - 1,
  endLine: d.lineEnd - 1,
  body: d.body,
})
const sameDraft = (a: DraftThreadInfo, b: DraftThreadInfo): boolean =>
  a.path === b.path && a.startLine === b.startLine && a.endLine === b.endLine && a.body === b.body

/**
 * The `pragma-review` comment controller: every line of worktree files, Send to Agent / Add to Review / Cancel, and
 * the worktree's stored drafts as read-only Pending threads (gone once sent or deleted, like Git Changes' cards).
 */
export class ReviewController {
  readonly #api: VscodeApi
  readonly #conn: CommentConnection
  #disposables: Disposable[] = []
  #controller: CommentControllerHandle | undefined
  /** The latest draft list; drawn once the controller exists. */
  #wanted: DraftThreadInfo[] = []
  readonly #drawn = new Map<string, { info: DraftThreadInfo; thread: Disposable }>()

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
    )
    this.#draw()
  }

  dispose(): void {
    this.#wanted = []
    this.#draw()
    this.#controller = undefined
    for (const d of this.#disposables.splice(0)) d.dispose()
  }

  /** Replaces the shown drafts: removed ones disappear, edited ones are redrawn, unchanged ones stay. */
  showDrafts(drafts: readonly EditorDraft[]): void {
    this.#wanted = drafts.map(toInfo)
    this.#draw()
  }

  /** Pulls the worktree's drafts from the app (after every hello); a failure keeps what is shown. */
  async refresh(): Promise<void> {
    try {
      this.showDrafts((await this.#conn.request(DRAFTS_MESSAGE, {})).comments)
    } catch (error) {
      this.#api.log(errorText(error))
    }
  }

  drafts(): DraftThreadInfo[] {
    return [...this.#drawn.values()].map((d) => d.info)
  }

  #draw(): void {
    const controller = this.#controller
    if (!controller) return
    const wanted = new Map(this.#wanted.map((d) => [d.id, d]))
    for (const [id, drawn] of this.#drawn) {
      const next = wanted.get(id)
      if (next && sameDraft(next, drawn.info)) continue
      drawn.thread.dispose()
      this.#drawn.delete(id)
    }
    const folder = this.#conn.folderPath ?? this.#api.workspaceFolderPath() ?? ''
    for (const info of wanted.values()) {
      if (this.#drawn.has(info.id)) continue
      const thread = controller.createThread({
        path: join(folder, info.path),
        startLine: info.startLine,
        endLine: info.endLine,
        body: info.body,
        label: M.pendingLabel,
      })
      this.#drawn.set(info.id, { info, thread })
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
      // The draft was stored: its Pending thread shows the comment, so the composer goes.
      if (result.commentId) {
        thread.dispose()
        return
      }
    }
    thread.addComment(text, M.notSentLabel)
  }
}
