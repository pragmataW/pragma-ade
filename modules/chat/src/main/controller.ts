import { randomUUID } from 'node:crypto'
import { type AgentProfile, type ModeStartRequest, SESSION_STATUS as S } from '@pragma/module-agents/contract'
import type { Logger } from '@pragma/sdk'
import {
  ATTACHMENT_KINDS,
  CHAT_MODE,
  type ChatCapability,
  type ChatEvent,
  type ChatEventEnvelope,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatSessionHandle,
  type ChatSessionStatus,
  type ChatSettings,
  type ChatTranscript,
  type ChatUserInput,
  ERROR_CODE,
  emptyTranscript,
  isChatStartupError,
  EVENT_KIND as K,
  MESSAGE_ORIGIN,
  nextStatus,
  RESPOND_UNSUPPORTED_KEY,
  reduceEvents,
  reduceTranscript,
  SESSION_EXIT_REASON,
  TURN_END_REASON,
  UNSUPPORTED_REASON,
  USER_ROLE,
  validateOptionValue,
  withCurrent,
} from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import type { StatusReporter } from './status-reporter'
import type { SupportCache } from './support-cache'

export interface ControllerDeps {
  sessionId: string
  agents: ChatAgentsApi
  resolveCapability(profile: Pick<AgentProfile, 'providerId'>): ChatCapability | undefined
  settings(): ChatSettings
  publish(env: ChatEventEnvelope): void
  supportCache: SupportCache
  statusReporter: StatusReporter
  log: Pick<Logger, 'info' | 'warn'>
  now?: () => number
}

export interface ChatSnapshot {
  providerId: string
  transcript: ChatTranscript
  status: ChatSessionStatus
}

interface QueuedInput extends ChatUserInput {
  id: string
}

export class RespondUnsupportedError extends Error {}
export class InvalidChatOptionError extends Error {}

const ENDED = new Set<ChatSessionStatus>([S.exited, S.error])
/** Lets 03 finish `startSession` bookkeeping before a fast startup failure reports the exit. */
const nextTurn = () => new Promise<void>((r) => setImmediate(r))

/**
 * One chat session in main: seq-numbered events (reduced, published, reported to 04), status (persisted through
 * `updateSession`, 11a is the sole writer), the user-message queue, options and resume after an exit.
 */
export class ChatSessionController {
  readonly #d: ControllerDeps
  readonly #now: () => number
  #seq = 0
  #transcript: ChatTranscript = emptyTranscript()
  #status: ChatSessionStatus = S.starting
  #providerId = ''
  #profile: AgentProfile | null = null
  #handle: ChatSessionHandle | null = null
  #req: ModeStartRequest | null = null
  #generation = 0
  #exitReported = true
  #attaching: Promise<void> | null = null
  #closeRequested = false
  #queue: QueuedInput[] = []
  #pendingDispatch: ChatUserInput | null = null
  #pendingOptions: Record<string, ChatOptionValue> = {}
  #externalSessionId: string | undefined

  constructor(deps: ControllerDeps) {
    this.#d = deps
    this.#now = deps.now ?? Date.now
  }

  get sessionId(): string {
    return this.#d.sessionId
  }

  /** A session without a live process: history (seq 1..n) and its last status. */
  initDormant(
    history: ChatEvent[],
    status: ChatSessionStatus,
    meta: { providerId: string; externalSessionId?: string },
  ) {
    this.#transcript = reduceEvents(history, this.#now())
    this.#seq = this.#transcript.lastSeq
    this.#status = status
    this.#providerId = meta.providerId
    this.#externalSessionId = meta.externalSessionId ?? this.#transcript.info.externalSessionId
  }

  snapshot(): ChatSnapshot {
    return { providerId: this.#providerId, transcript: this.#transcript, status: this.#status }
  }

  /** Resolves when the current attach finished its handshake (or failed). */
  whenAttached(): Promise<void> {
    return this.#attaching ?? Promise.resolve()
  }

  // ── events ──────────────────────────────────────────────────────────────

  #emit(event: ChatEvent): void {
    const env: ChatEventEnvelope = { sessionId: this.#d.sessionId, seq: ++this.#seq, at: this.#now(), event }
    this.#transcript = reduceTranscript(this.#transcript, env)
    if (event.kind === K.sessionInfo && event.externalSessionId) this.#externalSessionId = event.externalSessionId
    const next = nextStatus(this.#status, event, { pendingInteractions: this.#transcript.pendingInteractions })
    const changed = next !== this.#status
    this.#status = next
    this.#d.publish(env)
    this.#d.statusReporter.onEvent(this.#d.sessionId, event, this.#externalSessionId)
    if (event.kind === K.sessionExit) this.#onExit(event.exitCode)
    else if (changed) this.#persistStatus()
    if (event.kind === K.turnEnd) queueMicrotask(() => this.#dispatchNext())
  }

  #persistStatus(): void {
    this.#d.agents
      .updateSession(this.#d.sessionId, { status: this.#status })
      .catch((e: unknown) => this.#d.log.warn(`chat ${this.#d.sessionId}: status write failed`, e))
  }

  /** 03 writes `exited` on `reportExit`; a startup failure then re-writes `error` (11a is the status writer). */
  #onExit(exitCode: number | null): void {
    this.#handle = null
    if (!this.#exitReported && this.#req) {
      this.#exitReported = true
      this.#req.reportExit(exitCode)
    }
    if (this.#status !== S.exited) this.#persistStatus()
  }

  // ── attach / startup ────────────────────────────────────────────────────

  /** Starts (or resumes) the provider session for a mode-handler `start`; never rejects. */
  attach(req: ModeStartRequest): Promise<void> {
    this.#req = req
    this.#exitReported = false
    this.#closeRequested = false
    this.#handle = null
    this.#profile = req.profile
    this.#providerId = req.profile.providerId
    this.#status = S.starting
    const generation = ++this.#generation
    this.#attaching = this.#startup(req, generation).finally(() => {
      if (generation === this.#generation) this.#attaching = null
    })
    return this.#attaching
  }

  async #startup(req: ModeStartRequest, generation: number): Promise<void> {
    await nextTurn()
    const capability = this.#d.resolveCapability(req.profile)
    if (!capability) return this.#startupFailed(req.profile, UNSUPPORTED_REASON.noCapability)
    try {
      const env = await this.#d.agents.buildLaunchEnv({ sessionId: this.#d.sessionId, resume: req.resume })
      const handle = await capability.createSession({
        sessionId: this.#d.sessionId,
        profile: req.profile,
        worktreePath: req.worktree.path,
        env,
        resumeExternalSessionId: req.resume?.externalSessionId,
        initialOptions: { ...this.#pendingOptions },
        startupTimeoutMs: this.#d.settings().startupTimeoutMs,
        emit: (e) => {
          if (generation === this.#generation) this.#emit(e)
        },
      })
      await this.#ready(handle, req)
    } catch (e) {
      if (isChatStartupError(e)) return this.#startupFailed(req.profile, e.reasonKey, e.detail)
      this.#d.log.warn(`chat ${this.#d.sessionId}: startup failed`, e)
      this.#emit({ kind: K.error, code: ERROR_CODE.unknown, message: String(e), fatal: true })
      this.#emit({ kind: K.sessionExit, exitCode: null, reason: SESSION_EXIT_REASON.startup_failed })
    }
  }

  async #ready(handle: ChatSessionHandle, req: ModeStartRequest): Promise<void> {
    this.#handle = handle
    this.#pendingOptions = {}
    this.#d.supportCache.clear(req.profile)
    if (this.#closeRequested) return handle.close()
    this.#externalSessionId = handle.externalSessionId
    await this.#d.agents
      .updateSession(this.#d.sessionId, { externalSessionId: handle.externalSessionId })
      .catch((e: unknown) => this.#d.log.warn(`chat ${this.#d.sessionId}: externalSessionId write failed`, e))
    const first = req.initialPrompt?.trim() ? { text: req.initialPrompt, images: [] } : null
    const input = this.#pendingDispatch ?? first
    this.#pendingDispatch = null
    if (input) await this.#dispatch(input)
    else this.#dispatchNext()
  }

  #startupFailed(profile: AgentProfile, reasonKey: string, detail?: string): void {
    this.#d.supportCache.fail(profile, reasonKey, detail)
    this.#emit({
      kind: K.error,
      code: ERROR_CODE.startup_unsupported,
      message: reasonKey,
      ...(detail ? { detail } : {}),
      fatal: true,
    })
    this.#emit({ kind: K.sessionExit, exitCode: null, reason: SESSION_EXIT_REASON.startup_failed })
  }

  // ── sending ─────────────────────────────────────────────────────────────

  #busy(): boolean {
    return this.#transcript.turnActive || this.#status === S.starting || this.#transcript.pendingInteractions > 0
  }

  async send(input: ChatUserInput): Promise<{ queued: boolean }> {
    if (!this.#handle && !this.#attaching && (ENDED.has(this.#status) || this.#req === null)) {
      await this.#relaunch(input)
      return { queued: false }
    }
    if (this.#busy() || !this.#handle) {
      this.#queue = [...this.#queue, { ...input, id: randomUUID() }]
      this.#emitQueue()
      return { queued: true }
    }
    await this.#dispatch(input)
    return { queued: false }
  }

  /** A dormant or exited session: 03 relaunches the same row (resume when known); the input goes after the handshake. */
  async #relaunch(input: ChatUserInput): Promise<void> {
    this.#pendingDispatch = input
    const resume = this.#externalSessionId ? { externalSessionId: this.#externalSessionId } : undefined
    await this.#d.agents.relaunchSession(this.#d.sessionId, { mode: CHAT_MODE, ...(resume ? { resume } : {}) })
  }

  async #dispatch(input: ChatUserInput): Promise<void> {
    const handle = this.#handle
    if (!handle) return
    const attachments = input.images.map((i) => ({ kind: ATTACHMENT_KINDS[0], name: i.name, mediaType: i.mediaType }))
    this.#emit({
      kind: K.message,
      messageId: randomUUID(),
      role: USER_ROLE,
      text: input.text,
      attachments,
      origin: MESSAGE_ORIGIN.live,
    })
    this.#emit({ kind: K.turnStart, turnId: randomUUID() })
    try {
      await handle.send(input)
    } catch (e) {
      this.#emit({ kind: K.error, code: ERROR_CODE.unknown, message: String(e), fatal: false })
      this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    }
  }

  /** FIFO, one queued message per finished turn. */
  #dispatchNext(): void {
    if (!this.#handle || this.#busy() || this.#queue.length === 0) return
    const [next, ...rest] = this.#queue
    this.#queue = rest
    this.#emitQueue()
    if (next) void this.#dispatch({ text: next.text, images: next.images })
  }

  #emitQueue(): void {
    this.#emit({ kind: K.queue, queued: this.#queue.map((q) => ({ id: q.id, text: q.text })) })
  }

  cancelQueued(id: string): void {
    if (!this.#queue.some((q) => q.id === id)) return
    this.#queue = this.#queue.filter((q) => q.id !== id)
    this.#emitQueue()
  }

  // ── control ─────────────────────────────────────────────────────────────

  async interrupt(): Promise<void> {
    await this.#handle?.interrupt()
  }

  async respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void> {
    await this.#handle?.respondPermission(requestId, decision)
  }

  async respond(eventId: string, payload: unknown): Promise<void> {
    const respond = this.#handle?.respond
    if (!respond) throw new RespondUnsupportedError(RESPOND_UNSUPPORTED_KEY)
    await respond.call(this.#handle, eventId, payload)
  }

  /** Live: the adapter applies it. Dormant: kept and passed as `initialOptions` on resume. */
  async setOption(key: string, value: ChatOptionValue): Promise<void> {
    if (this.#handle) return this.#handle.setOption(key, value)
    const d = this.#transcript.info.options.find((o) => o.key === key)
    if (!d || !validateOptionValue(d, value)) throw new InvalidChatOptionError(`invalid option ${key}`)
    this.#pendingOptions = { ...this.#pendingOptions, [key]: value }
    this.#emit({ kind: K.options, options: withCurrent(this.#transcript.info.options, key, value) })
  }

  /** Graceful stop (also cancels a startup in flight); exit is confirmed through `reportExit`. */
  async close(): Promise<void> {
    if (this.#queue.length > 0) {
      this.#queue = []
      this.#emitQueue()
    }
    this.#pendingDispatch = null
    if (this.#attaching && !this.#handle) this.#closeRequested = true
    await this.#handle?.close()
  }

  async kill(): Promise<void> {
    if (this.#handle?.kill) return this.#handle.kill()
    await this.close()
  }

  get profile(): AgentProfile | null {
    return this.#profile
  }
}
