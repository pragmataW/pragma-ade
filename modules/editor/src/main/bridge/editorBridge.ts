import { randomUUID } from 'node:crypto'
import type { BridgeRequestContext } from '@pragma/module-bridge/contract'
import { COMMENT_SOURCE, type Comment, SEND_STATUS, type SendResult } from '@pragma/module-comments/contract'
import {
  BRIDGE_ERRORS,
  CLIENT_EVENT,
  NOT_A_WORKTREE,
  OPEN_FILE_READY_TIMEOUT_MS,
  TEST_REQUEST_TIMEOUT_MS,
} from '../../constants'
import {
  COMMENT_ACTION,
  COMMENT_REPLY,
  type EditorComment,
  type EditorCommentReply,
  type EditorDraft,
  type EditorDrafts,
  type EditorHello,
  type EditorHelloReply,
  type EditorLanguageStatus,
  type EditorOpenDiffMsg,
  type EditorOpenFileMsg,
  type EditorSetThemeMsg,
  type EditorTestRequest,
  type EditorTestResponse,
  editorBridge,
} from '../../contract'
import type { EditorUpstream } from '../upstream'

const EVENT = (name: keyof typeof editorBridge.events): string => `${editorBridge.name}.${name}`

export class EditorBridgeError extends Error {}

interface Pending {
  resolve(v: unknown): void
  reject(e: Error): void
  timer: ReturnType<typeof setTimeout>
}

export interface EditorBridgeOptions {
  theme: () => EditorSetThemeMsg
  /** The live view's worktree for a folder key (fast path before scanning projects). */
  folderToWorktree: (folderKey: string) => string | undefined
  onLanguageStatus?: (worktreeId: string, status: EditorLanguageStatus | null) => void
}

function replyForSend(commentId: string, r: SendResult): EditorCommentReply {
  switch (r.status) {
    case SEND_STATUS.sent:
      return { status: COMMENT_REPLY.sent, commentId }
    case SEND_STATUS.needsTarget:
    case SEND_STATUS.noSession:
      return { status: COMMENT_REPLY.needsUserAction, commentId }
    case SEND_STATUS.failed:
      return { status: COMMENT_REPLY.failed, message: r.message ?? r.errorKey, commentId }
    default: {
      const never: never = r
      return never
    }
  }
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** The editor drafts the workbench shows (diff and browser comments stay in their own panels). */
function toEditorDrafts(comments: readonly Comment[]): EditorDrafts {
  const drafts: EditorDraft[] = []
  for (const c of comments) {
    if (c.source !== COMMENT_SOURCE.editor || !c.filePath || c.lineStart === undefined) continue
    drafts.push({
      id: c.id,
      filePath: c.filePath,
      lineStart: c.lineStart,
      lineEnd: c.lineEnd ?? c.lineStart,
      body: c.body,
    })
  }
  return { comments: drafts }
}

/** Main side of the `editor` namespace: client registry (folder → client), openFile/openDiff/theme/test requests, comments. */
export class EditorBridge {
  readonly #up: EditorUpstream
  readonly #o: EditorBridgeOptions
  readonly #folderOfClient = new Map<string, string>()
  readonly #clientOfFolder = new Map<string, string>()
  readonly #waiters = new Map<string, Set<() => void>>()
  readonly #pendingTests = new Map<string, Pending>()
  readonly #languageOf = new Map<string, string>()
  readonly #worktreeOfClient = new Map<string, string>()

  constructor(up: EditorUpstream, o: EditorBridgeOptions) {
    this.#up = up
    this.#o = o
  }

  register(): () => void {
    const unregister = this.#up.bridge.registerHandler(editorBridge, {
      hello: (p, ctx) => this.#hello(p, ctx),
      comment: (p, ctx) => this.#comment(p, ctx),
      testResponse: (p) => this.#testResponse(p),
      languageStatus: (p, ctx) => this.#languageStatus(p, ctx),
      drafts: (_p, ctx) => this.#draftsOf(this.#worktreeOfClient.get(ctx.clientId)),
    })
    const offClient = this.#up.bridge.onClient(CLIENT_EVENT.disconnected, (c) => this.#forget(c.clientId))
    // A failed push is dropped: the next change or the extension's next hello resyncs.
    const offComments = this.#up.onCommentsChanged(
      (worktreeId) => void this.#pushDrafts(worktreeId).catch(() => undefined),
    )
    return () => {
      unregister()
      offClient()
      offComments()
    }
  }

  isReady(folderKey: string): boolean {
    return this.#clientOfFolder.has(folderKey)
  }

  whenReady(folderKey: string, timeoutMs = OPEN_FILE_READY_TIMEOUT_MS): Promise<void> {
    if (this.isReady(folderKey)) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const set = this.#waiters.get(folderKey) ?? new Set()
      this.#waiters.set(folderKey, set)
      const done = (): void => {
        clearTimeout(timer)
        set.delete(done)
        resolve()
      }
      const timer = setTimeout(() => {
        set.delete(done)
        reject(new EditorBridgeError(BRIDGE_ERRORS.notReady))
      }, timeoutMs)
      set.add(done)
    })
  }

  async openFile(folderKey: string, m: EditorOpenFileMsg, timeoutMs?: number): Promise<void> {
    await this.whenReady(folderKey, timeoutMs)
    this.#sendTo(folderKey, EVENT('openFile'), m)
  }

  async openDiff(folderKey: string, m: EditorOpenDiffMsg, timeoutMs?: number): Promise<void> {
    await this.whenReady(folderKey, timeoutMs)
    this.#sendTo(folderKey, EVENT('openDiff'), m)
  }

  pushTheme(override?: EditorSetThemeMsg): void {
    this.#up.bridge.broadcast(editorBridge, { name: 'setTheme', payload: override ?? this.#o.theme() })
  }

  async testRequest(
    folderKey: string,
    op: EditorTestRequest['op'],
    args?: unknown,
    timeoutMs = TEST_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    await this.whenReady(folderKey, timeoutMs)
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pendingTests.delete(requestId)
        reject(new EditorBridgeError(BRIDGE_ERRORS.timeout))
      }, timeoutMs)
      this.#pendingTests.set(requestId, { resolve, reject, timer })
      this.#sendTo(folderKey, EVENT('testRequest'), { requestId, op, args: args ?? null })
    })
  }

  /** After a server restart every extension host reconnects and says hello again. */
  resetReady(): void {
    this.#folderOfClient.clear()
    this.#clientOfFolder.clear()
  }

  #sendTo(folderKey: string, type: string, payload: unknown): void {
    const clientId = this.#clientOfFolder.get(folderKey)
    if (!clientId || !this.#up.bridge.send(clientId, { type, payload }))
      throw new EditorBridgeError(BRIDGE_ERRORS.notReady)
  }

  async #worktreeFor(folderKey: string | undefined): Promise<string | null> {
    if (folderKey === undefined) return null
    return this.#o.folderToWorktree(folderKey) ?? (await this.#up.findWorktreeByFolderKey(folderKey))?.id ?? null
  }

  async #hello(p: EditorHello, ctx: BridgeRequestContext): Promise<EditorHelloReply> {
    this.#folderOfClient.set(ctx.clientId, p.folderKey)
    this.#clientOfFolder.set(p.folderKey, ctx.clientId)
    for (const done of [...(this.#waiters.get(p.folderKey) ?? [])]) done()
    const worktreeId = await this.#worktreeFor(p.folderKey)
    if (worktreeId) this.#worktreeOfClient.set(ctx.clientId, worktreeId)
    else this.#worktreeOfClient.delete(ctx.clientId)
    return { known: worktreeId !== null, worktreeId, theme: this.#o.theme() }
  }

  async #comment(p: EditorComment, ctx: BridgeRequestContext): Promise<EditorCommentReply> {
    const worktreeId = await this.#worktreeFor(this.#folderOfClient.get(ctx.clientId))
    if (!worktreeId) return { status: COMMENT_REPLY.failed, message: NOT_A_WORKTREE }
    let commentId: string
    try {
      const draft = await this.#up.addDraft({
        worktreeId,
        source: COMMENT_SOURCE.editor,
        filePath: p.filePath,
        lineStart: p.lineStart,
        lineEnd: p.lineEnd,
        snippet: p.snippet,
        ...(p.language ? { language: p.language } : {}),
        body: p.body,
      })
      commentId = draft.id
    } catch (error) {
      return { status: COMMENT_REPLY.failed, message: errorText(error) }
    }
    if (p.action === COMMENT_ACTION.draft) return { status: COMMENT_REPLY.drafted, commentId }
    return replyForSend(commentId, await this.#up.send(worktreeId))
  }

  async #draftsOf(worktreeId: string | undefined): Promise<EditorDrafts> {
    return worktreeId ? toEditorDrafts(await this.#up.listThreads(worktreeId)) : { comments: [] }
  }

  /** Every client showing `worktreeId` gets its drafts; a client that went away in between is skipped. */
  async #pushDrafts(worktreeId: string): Promise<void> {
    const clients = [...this.#worktreeOfClient].filter(([, w]) => w === worktreeId).map(([clientId]) => clientId)
    if (clients.length === 0) return
    const payload = await this.#draftsOf(worktreeId)
    for (const clientId of clients) this.#up.bridge.send(clientId, { type: EVENT('drafts'), payload })
  }

  #testResponse(p: EditorTestResponse): null {
    const pending = this.#pendingTests.get(p.requestId)
    if (!pending) return null
    this.#pendingTests.delete(p.requestId)
    clearTimeout(pending.timer)
    if (p.error !== undefined) pending.reject(new EditorBridgeError(p.error))
    else pending.resolve(p.result ?? null)
    return null
  }

  async #languageStatus(p: EditorLanguageStatus, ctx: BridgeRequestContext): Promise<null> {
    const worktreeId = await this.#worktreeFor(this.#folderOfClient.get(ctx.clientId))
    if (!worktreeId) return null
    this.#languageOf.set(ctx.clientId, worktreeId)
    this.#o.onLanguageStatus?.(worktreeId, p)
    return null
  }

  #forget(clientId: string): void {
    const folderKey = this.#folderOfClient.get(clientId)
    this.#folderOfClient.delete(clientId)
    this.#worktreeOfClient.delete(clientId)
    if (folderKey !== undefined && this.#clientOfFolder.get(folderKey) === clientId)
      this.#clientOfFolder.delete(folderKey)
    const worktreeId = this.#languageOf.get(clientId)
    this.#languageOf.delete(clientId)
    if (worktreeId) this.#o.onLanguageStatus?.(worktreeId, null)
  }
}
