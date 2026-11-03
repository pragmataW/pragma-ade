import { randomUUID } from 'node:crypto'
import { type AgentProfile, type ModeStartRequest, SESSION_STATUS as S } from '@pragma/module-agents/contract'
import type { Logger } from '@pragma/sdk'
import {
  CHAT_MODE,
  type ChatCapability,
  type ChatEvent,
  type ChatEventEnvelope,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatResumeFallbackListener,
  type ChatSessionAction,
  type ChatSessionHandle,
  type ChatSessionStatus,
  type ChatSettings,
  type ChatStartGuard,
  type ChatStartupError,
  type ChatTranscript,
  type ChatUserInput,
  ERROR_CODE,
  emptyTranscript,
  isChatStartupError,
  EVENT_KIND as K,
  MESSAGE_ORIGIN,
  nextStatus,
  RESPOND_UNSUPPORTED_KEY,
  RESUME_REASON,
  reduceEvents,
  reduceTranscript,
  SESSION_EXIT_REASON,
  supportedActions,
  TURN_END_REASON,
  UNSUPPORTED_PREFIX,
  UNSUPPORTED_REASON,
  USER_ROLE,
  validateOptionValue,
  withCurrent,
} from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import { acceptedInput, attachmentRefs, runSessionAction } from './session-actions'
import type { SessionOptionsStore } from './session-options-store'
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
  /** 11c: refuses a resume of an external session another app session owns. */
  startGuard?: ChatStartGuard
  /** A resume found no conversation and a fresh session was started instead. */
  onResumeFallback?: ChatResumeFallbackListener
  /** The last options and the user's choices, kept across chat process restarts and app restarts. */
  optionsStore?: SessionOptionsStore
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
  #capability: ChatCapability | null = null
  #req: ModeStartRequest | null = null
  #generation = 0
  #exitReported = true
  #attaching: Promise<void> | null = null
  #closeRequested = false
  #queue: QueuedInput[] = []
  #pendingDispatch: ChatUserInput | null = null
  /** Values the user chose (kept current by later `options` events): `initialOptions` of every (re)start. */
  #chosen: Record<string, ChatOptionValue>
  #externalSessionId: string | undefined

  constructor(deps: ControllerDeps) {
    this.#d = deps
    this.#now = deps.now ?? Date.now
    this.#chosen = deps.optionsStore?.get(deps.sessionId)?.chosen ?? {}
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
    const saved = this.#d.optionsStore?.get(this.#d.sessionId)?.options
    const restored = saved?.length && !history.some((e) => e.kind === K.options)
    this.#transcript = reduceEvents(restored ? [...history, { kind: K.options, options: saved }] : history, this.#now())
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
    if (event.kind === K.sessionInfo && event.externalSessionId) this.#followExternalSession(event.externalSessionId)
    if (event.kind === K.options) this.#saveOptions(event.options)
    const next = nextStatus(this.#status, event, { pendingInteractions: this.#transcript.pendingInteractions })
    const changed = next !== this.#status
    this.#status = next
    this.#d.publish(env)
    this.#d.statusReporter.onEvent(this.#d.sessionId, event, this.#externalSessionId)
    if (event.kind === K.sessionExit) this.#onExit(event.exitCode)
    else if (changed) this.#persistStatus()
    if (event.kind === K.turnEnd) queueMicrotask(() => this.#dispatchNext())
  }

  /**
   * The provider switched conversations mid-session (e.g. an OpenCode fork): the agent session follows, so resume,
   * chat ⇄ terminal and `pragma session locate` use the conversation the tab now shows.
   */
  #followExternalSession(id: string): void {
    const changed = this.#handle !== null && this.#externalSessionId !== undefined && id !== this.#externalSessionId
    this.#externalSessionId = id
    if (!changed) return
    this.#d.agents
      .updateSession(this.#d.sessionId, { externalSessionId: id })
      .catch((e: unknown) => this.#d.log.warn(`chat ${this.#d.sessionId}: externalSessionId write failed`, e))
  }

  /** Chosen keys follow the agent (e.g. plan mode left after an approved plan); unknown keys keep their value. */
  #saveOptions(options: ChatOptionDescriptor[]): void {
    const current = new Map(options.map((o) => [o.key, o.current]))
    this.#chosen = Object.fromEntries(
      Object.entries(this.#chosen).map(([k, v]) => [k, current.has(k) ? (current.get(k) as ChatOptionValue) : v]),
    )
    this.#d.optionsStore?.set(this.#d.sessionId, { options, chosen: this.#chosen })
  }

  #choose(key: string, value: ChatOptionValue): void {
    this.#chosen = { ...this.#chosen, [key]: value }
    this.#saveOptions(this.#transcript.info.options)
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
    this.#capability = capability ?? null
    if (!capability) return this.#startupFailed(req.profile, UNSUPPORTED_REASON.noCapability)
    const refused = this.#guardRefusal(req)
    if (refused) return this.#fatalStartup(ERROR_CODE.unknown, refused)
    try {
      const handle = await this.#open(capability, req, generation, req.resume).catch((e: unknown) =>
        this.#openFresh(capability, req, generation, e),
      )
      await this.#ready(handle, req)
    } catch (e) {
      if (isChatStartupError(e)) return this.#startupError(req.profile, e)
      this.#d.log.warn(`chat ${this.#d.sessionId}: startup failed`, e)
      this.#fatalStartup(ERROR_CODE.unknown, String(e))
    }
  }

  async #open(
    capability: ChatCapability,
    req: ModeStartRequest,
    generation: number,
    resume: ModeStartRequest['resume'],
  ): Promise<ChatSessionHandle> {
    const env = await this.#d.agents.buildLaunchEnv({ sessionId: this.#d.sessionId, resume })
    return capability.createSession({
      sessionId: this.#d.sessionId,
      profile: req.profile,
      worktreePath: req.worktree.path,
      env,
      resumeExternalSessionId: resume?.externalSessionId,
      initialOptions: { ...this.#chosen },
      startupTimeoutMs: this.#d.settings().startupTimeoutMs,
      emit: (e) => {
        if (generation === this.#generation) this.#emit(e)
      },
    })
  }

  /** A resume of a conversation the agent has no record of starts a fresh session in the same worktree (once). */
  async #openFresh(
    capability: ChatCapability,
    req: ModeStartRequest,
    generation: number,
    error: unknown,
  ): Promise<ChatSessionHandle> {
    const from = req.resume?.externalSessionId
    if (!from || !isChatStartupError(error) || error.reasonKey !== RESUME_REASON.notFound) throw error
    this.#d.log.info(`chat ${this.#d.sessionId}: nothing to resume for ${from} (${error.detail ?? ''}), starting fresh`)
    const handle = await this.#open(capability, req, generation, undefined)
    this.#d.onResumeFallback?.({ sessionId: this.#d.sessionId, externalSessionId: from })
    return handle
  }

  /** `chat:unsupported.*` marks the profile unsupported; any other reason (a failed resume) only fails this start. */
  #startupError(profile: AgentProfile, e: ChatStartupError): void {
    if (e.reasonKey.startsWith(UNSUPPORTED_PREFIX)) this.#startupFailed(profile, e.reasonKey, e.detail)
    else this.#fatalStartup(ERROR_CODE.unknown, e.reasonKey, e.detail)
  }

  async #ready(handle: ChatSessionHandle, req: ModeStartRequest): Promise<void> {
    this.#handle = handle
    this.#d.supportCache.clear(req.profile)
    if (this.#closeRequested) return handle.close()
    const actions = supportedActions(handle)
    if (actions.length > 0) this.#emit({ kind: K.sessionInfo, actions })
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

  /** The reason key when a registered start guard refuses this resume, else null. */
  #guardRefusal(req: ModeStartRequest): string | null {
    const externalSessionId = req.resume?.externalSessionId
    if (!externalSessionId || !this.#d.startGuard) return null
    const r = this.#d.startGuard({
      sessionId: this.#d.sessionId,
      providerId: req.profile.providerId,
      externalSessionId,
    })
    return r.ok ? null : r.reasonKey
  }

  #startupFailed(profile: AgentProfile, reasonKey: string, detail?: string): void {
    this.#d.supportCache.fail(profile, reasonKey, detail)
    this.#fatalStartup(ERROR_CODE.startup_unsupported, reasonKey, detail)
  }

  #fatalStartup(code: (typeof ERROR_CODE)[keyof typeof ERROR_CODE], message: string, detail?: string): void {
    this.#emit({ kind: K.error, code, message, ...(detail ? { detail } : {}), fatal: true })
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
    if (this.#takesMidTurnInput()) {
      await this.#dispatch(input, true)
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

  /** A running turn of a `midTurnInput` provider takes the message now (the agent folds it in itself). */
  #takesMidTurnInput(): boolean {
    return Boolean(
      this.#handle && this.#capability?.midTurnInput && this.#transcript.turnActive && this.#status !== S.starting,
    )
  }

  /** `midTurn`: into the running turn (no new turn; a failure does not end it). */
  async #dispatch(input: ChatUserInput, midTurn = false): Promise<void> {
    const handle = this.#handle
    if (!handle) return
    const accepted = acceptedInput(input, this.#capability?.attachmentKinds)
    const messageId = randomUUID()
    this.#emit({
      kind: K.message,
      messageId,
      role: USER_ROLE,
      text: input.text,
      attachments: attachmentRefs(accepted),
      origin: MESSAGE_ORIGIN.live,
      ...(midTurn ? { midTurn } : {}),
    })
    if (!midTurn) this.#emit({ kind: K.turnStart, turnId: randomUUID() })
    try {
      await handle.send({ ...accepted, messageId }, { messageId })
    } catch (e) {
      this.#emit({ kind: K.error, code: ERROR_CODE.unknown, message: String(e), fatal: false })
      if (!midTurn) this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    }
  }

  /** FIFO, one queued message per finished turn. */
  #dispatchNext(): void {
    if (!this.#handle || this.#busy() || this.#queue.length === 0) return
    const [next, ...rest] = this.#queue
    this.#queue = rest
    this.#emitQueue()
    if (next) {
      const { id: _id, ...input } = next
      void this.#dispatch(input)
    }
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

  /** An optional session action; rejects with `ActionUnsupportedError` when the live handle lacks it. */
  action(a: ChatSessionAction): Promise<void> {
    return runSessionAction(this.#handle, a, (e) => this.#emit(e))
  }

  /**
   * Live: the adapter applies it. Dormant: shown at once. Either way the choice is kept and passed as
   * `initialOptions` whenever the chat process (re)starts.
   */
  async setOption(key: string, value: ChatOptionValue): Promise<void> {
    const handle = this.#handle
    if (handle) {
      await handle.setOption(key, value)
      return this.#choose(key, value)
    }
    const d = this.#transcript.info.options.find((o) => o.key === key)
    if (!d || !validateOptionValue(d, value)) throw new InvalidChatOptionError(`invalid option ${key}`)
    this.#chosen = { ...this.#chosen, [key]: value }
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
