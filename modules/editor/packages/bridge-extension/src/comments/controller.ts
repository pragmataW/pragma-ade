import {
  COMMENT_ACTION,
  COMMENT_REPLY,
  type CommentAction,
  type EditorCommentReply,
} from '@pragma/module-editor/contract'
import type { BridgeConnection } from '../bridgeConnection'
import { COMMANDS, CONTROLLER, FILE_SCHEME, COMMENT_MESSAGES as M } from '../constants'
import { isInsideFolder } from '../handlers/openFile'
import type { Disposable, DocumentInfo, ThreadLike, VscodeApi } from '../vscodeApi'
import { buildCommentPayload } from './payload'

export type ReplyLike = { thread: ThreadLike; text: string }
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

/** The `pragma-review` comment controller: every line of worktree files, Send to Agent / Add to Review / Cancel. */
export class ReviewController {
  readonly #api: VscodeApi
  readonly #conn: CommentConnection
  #disposables: Disposable[] = []

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
    this.#disposables.push(
      api.createCommentController({ ...CONTROLLER, ranges: (doc) => this.ranges(doc) }),
      api.registerReplyCommand(COMMANDS.sendToAgent, (r) => this.handle(r, COMMENT_ACTION.send)),
      api.registerReplyCommand(COMMANDS.addToReview, (r) => this.handle(r, COMMENT_ACTION.draft)),
      api.registerReplyCommand(COMMANDS.cancel, (r) => r.thread.dispose()),
    )
  }

  dispose(): void {
    for (const d of this.#disposables.splice(0)) d.dispose()
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
    if (result.status === COMMENT_REPLY.failed) this.#api.showWarning(result.message)
    thread.addComment(text, M.notSentLabel)
  }
}
