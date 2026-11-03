import { existsSync } from 'node:fs'
import {
  CHAT_OPTION_KEYS,
  type ChatEvent,
  type ChatMcpServer,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatSendMeta,
  type ChatSessionContext,
  type ChatSessionHandle,
  ChatStartupError,
  type ChatUserInput,
  ERROR_CODE,
  EVENT_KIND as K,
  MCP_STATUS,
  PERMISSION_OPTION,
  PERMISSION_OUTCOME,
  RESPONSE_OUTCOME,
  RESUME_REASON,
  SESSION_EXIT_REASON,
  TURN_END_REASON,
} from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import { CUSTOM, type FormField, formPayloadSchema, NOTICE } from '../../renderer/chat/payloads'
import {
  AGENT_OPTION_KEY,
  type BUSY_DELIVERIES,
  BUSY_DELIVERY,
  EV,
  FORM_CANCEL_MESSAGE,
  IDLE_OUTCOMES,
  INVALID_FORM_ANSWER,
  MCP_STATUS_OF,
  MESSAGE_TYPES,
  ORDER,
  OTHER_EVENT,
  PERMISSION_MODE,
  REASON,
  SERVER_EXITED_KEY,
  SESSION_NOT_FOUND,
} from './constants'
import { EventMapper } from './mapping/event-mapper'
import { parseFormResponse } from './mapping/form-answer'
import { parseSlash, toDecision, toPrompt } from './mapping/input'
import {
  applyOption,
  buildOptionDescriptors,
  type Catalog,
  contextWindowOf,
  modelInputOf,
  modelRefOf,
  modelValue,
  type Selection,
} from './mapping/options'
import {
  agentInfoSchema,
  commandSchema,
  defaultModelSchema,
  idSchema,
  listOf,
  type ModelRef,
  mcpServerSchema,
  messagePageSchema,
  type OpencodeCommand,
  parseV2Event,
  revertSchema,
  type SessionInfo,
  sessionInfoSchema,
} from './schemas'
import type { ConnectionPool, OpencodeConnection } from './server/connection'
import type { Lease } from './server/pool'
import { SubagentTracker } from './subagents'
import type { HubEvent } from './wire/event-hub'

type Log = Pick<Logger, 'info' | 'warn'>
const [SUCCEEDED, FAILED] = IDLE_OUTCOMES
export type BusyDelivery = (typeof BUSY_DELIVERIES)[number]
/** Options that change the session's model (`switchModel`). */
const MODEL_OPTION_KEYS = new Set<string>([CHAT_OPTION_KEYS.model, CHAT_OPTION_KEYS.effort])

async function loadCatalog(conn: OpencodeConnection): Promise<{ catalog: Catalog; commands: OpencodeCommand[] }> {
  const { client } = conn
  const [models, def, agents, commands, access] = await Promise.all([
    conn.models(),
    client.model.default(),
    client.agent.list(),
    client.command.list(),
    conn.access(),
  ])
  return {
    catalog: {
      models,
      defaultModel: defaultModelSchema.parse(def).data,
      agents: listOf(agentInfoSchema).parse(agents).data,
      access,
    },
    commands: listOf(commandSchema).parse(commands).data,
  }
}

/** Valid `initialOptions` applied in order over `sel` (invalid ones are skipped). */
function withInitialOptions(
  sel: Selection,
  catalog: Catalog,
  initial: Record<string, ChatOptionValue> = {},
): Selection {
  return Object.entries(initial).reduce((acc, [key, value]) => {
    try {
      return applyOption(acc, key, value, buildOptionDescriptors(catalog, acc))
    } catch {
      return acc
    }
  }, sel)
}

/** Without a pick, the server default unless the picker hides it (its provider cannot answer): then the first. */
function withUsableModel(sel: Selection, catalog: Catalog): Selection {
  if (sel.model) return sel
  const fallback = buildOptionDescriptors(catalog, sel).find((d) => d.key === CHAT_OPTION_KEYS.model)?.default
  const serverDefault = catalog.defaultModel ? modelValue(catalog.defaultModel) : null
  return typeof fallback === 'string' && fallback !== serverDefault ? { ...sel, model: fallback } : sel
}

const selectionOf = (info: SessionInfo): Selection => ({
  ...(info.model ? { model: modelValue(info.model), effort: info.model.variant ?? null } : {}),
  ...(info.agent ? { agent: info.agent } : {}),
})

/** One OpenCode 2.x session on a pooled `serve` (`ChatSessionHandle`). */
export class OpencodeChatSession implements ChatSessionHandle {
  readonly #ctx: ChatSessionContext
  readonly #lease: Lease<OpencodeConnection>
  readonly #conn: OpencodeConnection
  readonly #log: Log
  readonly #mapper: EventMapper
  readonly #subagents: SubagentTracker
  #catalog: Catalog
  readonly #commands: string[]
  readonly #forms = new Map<string, FormField[]>()
  readonly #unsubscribe: (() => void)[] = []
  #sel: Selection
  #options: ChatOptionDescriptor[]
  #turnActive = false
  #closed = false
  readonly #busyDelivery: BusyDelivery
  #sessionId: string
  #unsubscribeRoot: () => void = () => undefined
  /** Transcript message id → OpenCode user message id (rewind and fork targets). */
  readonly #messageIds = new Map<string, string>()
  readonly #commandList: OpencodeCommand[]

  /** The OpenCode session (a fork switches it). */
  get externalSessionId(): string {
    return this.#sessionId
  }

  private constructor(o: {
    ctx: ChatSessionContext
    lease: Lease<OpencodeConnection>
    log: Log
    catalog: Catalog
    commands: OpencodeCommand[]
    info: SessionInfo
    sel: Selection
    busyDelivery?: BusyDelivery
  }) {
    this.#ctx = o.ctx
    this.#busyDelivery = o.busyDelivery ?? BUSY_DELIVERY
    this.#lease = o.lease
    this.#conn = o.lease.resource
    this.#log = o.log
    this.#catalog = o.catalog
    this.#commands = o.commands.map((c) => c.name)
    this.#commandList = o.commands
    this.#sel = o.sel
    this.#options = buildOptionDescriptors(o.catalog, o.sel)
    this.#sessionId = o.info.id
    const contextWindow = (ref: ModelRef) => contextWindowOf(o.catalog.models, ref)
    this.#mapper = new EventMapper({ contextWindow })
    this.#subagents = new SubagentTracker({
      rootSessionId: o.info.id,
      subscribe: (id, cb) => this.#conn.hub.subscribe(id, (e) => !this.#closed && cb(e)),
      emit: (e) => this.#emit(e),
      contextWindow,
      now: Date.now,
    })
  }

  /** acquire → catalog → get (resume) or create → subscribe → `session-info` + `options`. */
  static async start(
    ctx: ChatSessionContext,
    pool: ConnectionPool,
    log: Log,
    opts: { busyDelivery?: BusyDelivery } = {},
  ): Promise<OpencodeChatSession> {
    const lease = await pool.acquire(ctx)
    try {
      const conn = lease.resource
      const { catalog, commands } = await loadCatalog(conn).catch((e: unknown) => {
        throw new ChatStartupError(REASON.infoFailed, String(e))
      })
      const opened = ctx.resumeExternalSessionId
        ? await OpencodeChatSession.#resume(conn, ctx, catalog)
        : await OpencodeChatSession.#create(conn, ctx, catalog)
      const session = new OpencodeChatSession({ ctx, lease, log, catalog, commands, ...opened, ...opts })
      session.#attach()
      return session
    } catch (e) {
      lease.release()
      throw e
    }
  }

  static async #create(conn: OpencodeConnection, ctx: ChatSessionContext, catalog: Catalog) {
    const sel = withUsableModel(withInitialOptions({}, catalog, ctx.initialOptions), catalog)
    const model = modelInputOf(sel)
    const raw = await conn.client.session.create({
      ...(sel.agent ? { agent: sel.agent } : {}),
      ...(model ? { model } : {}),
    })
    return { info: sessionInfoSchema.parse(raw), sel }
  }

  static async #resume(conn: OpencodeConnection, ctx: ChatSessionContext, catalog: Catalog) {
    const sessionID = ctx.resumeExternalSessionId ?? ''
    // 11c: the serve does not know the id → `notFound` (the core starts a fresh session, never "unsupported")
    const raw = await conn.client.session.get({ sessionID }).catch((e: unknown) => {
      throw new ChatStartupError(RESUME_REASON.notFound, `${SESSION_NOT_FOUND}: ${sessionID} (${String(e)})`)
    })
    const info = sessionInfoSchema.parse(raw)
    const base = selectionOf(info)
    const sel = withInitialOptions(base, catalog, ctx.initialOptions)
    const model = modelInputOf(sel)
    if (model && sel.model !== base.model) await conn.client.session.switchModel({ sessionID, model })
    if (sel.agent && sel.agent !== base.agent) await conn.client.session.switchAgent({ sessionID, agent: sel.agent })
    return { info, sel }
  }

  #attach(): void {
    const { hub } = this.#conn
    this.#subscribeRoot()
    this.#unsubscribe.push(
      () => this.#unsubscribeRoot(),
      hub.onReconnect(() => void this.#resync()),
      hub.onGlobal((e) => {
        if (e.type === EV.mcpStatusChanged) void this.#emitMcp()
      }),
      this.#conn.onCatalogChange(() => void this.#refreshCatalog()),
      this.#conn.onExit((code) => this.#onServerExit(code)),
    )
    this.#emitSessionInfo()
    this.#emit({ kind: K.options, options: this.#options })
    void this.#emitMcp()
  }

  #subscribeRoot(): void {
    this.#unsubscribeRoot()
    this.#unsubscribeRoot = this.#conn.hub.subscribe(this.#sessionId, (e) => this.#onEvent(e))
  }

  #emitSessionInfo(): void {
    this.#emit({
      kind: K.sessionInfo,
      externalSessionId: this.#sessionId,
      commands: this.#commandList.map((c) => ({ name: c.name, description: c.description ?? '' })),
    })
  }

  // ── events ──────────────────────────────────────────────────────────────

  #emit(e: ChatEvent): void {
    if (e.kind === K.turnEnd) this.#turnActive = false
    if (e.kind === K.error && e.code === ERROR_CODE.auth) this.#authFailed()
    if (e.kind === K.permissionRequest && this.#autoApprove) queueMicrotask(() => this.#approve(e.requestId))
    if (e.kind === K.custom && e.type === CUSTOM.form && e.eventId) {
      const form = formPayloadSchema.safeParse(e.data)
      if (form.success) this.#forms.set(e.eventId, form.data.fields)
    }
    if (e.kind === K.responseResolved) this.#forms.delete(e.eventId)
    this.#ctx.emit(e)
  }

  #onEvent(e: HubEvent): void {
    if (this.#closed) return
    this.#subagents.observe(this.externalSessionId, e)
    for (const out of this.#mapper.map(e)) {
      if (out.kind === K.turnEnd) this.#subagents.endAll(out.reason)
      this.#emit(out)
    }
  }

  /** The root mapper and every subagent's, with the session each one translates. */
  #mappers(): { sessionId: string; mapper: EventMapper }[] {
    return [{ sessionId: this.externalSessionId, mapper: this.#mapper }, ...this.#subagents.mappers]
  }

  #approve(requestId: string): void {
    const owner = this.#mappers().find((x) => x.mapper.pendingPermissions.includes(requestId))
    if (owner) this.#approveAll(owner.sessionId, owner.mapper)
  }

  /** The session (root or subagent) a pending permission or form belongs to. */
  #ownerOf(id: string, pending: (m: EventMapper) => string[]): string | undefined {
    return this.#mappers().find((x) => pending(x.mapper).includes(id))?.sessionId
  }

  /** v2 streams are volatile: after a reconnect, a turn that ended meanwhile is closed from its `idle` message. */
  async #resync(): Promise<void> {
    if (this.#closed || !this.#mapper.turnActive) return
    try {
      const sessionID = this.externalSessionId
      const active = await this.#conn.client.session.active()
      if (sessionID in active) return
      const raw = await this.#conn.client.message.list({
        sessionID,
        order: ORDER.desc,
        limit: 1,
        type: MESSAGE_TYPES.idle,
      })
      const idle = messagePageSchema.parse(raw).data.find((m) => m.type === MESSAGE_TYPES.idle)
      if (!idle || idle.type !== MESSAGE_TYPES.idle) return
      const type =
        idle.outcome === SUCCEEDED
          ? EV.executionSucceeded
          : idle.outcome === FAILED
            ? EV.executionFailed
            : EV.executionInterrupted
      const synthetic = parseV2Event({
        id: idle.id,
        type,
        data: { sessionID, error: idle.error ?? { type, message: type } },
      })
      if (synthetic && synthetic.type !== OTHER_EVENT) this.#onEvent(synthetic)
    } catch (e) {
      this.#log.warn(`opencode chat ${this.#ctx.sessionId}: resync failed`, e)
    }
  }

  /** The provider of the model in use rejected its credential: the picker flags it (per server) until it is fixed. */
  #authFailed(): void {
    const model = this.#mapper.model ?? (this.#sel.model ? modelRefOf(this.#sel.model) : undefined)
    if (model) this.#conn.markAuthFailed(model.providerID)
  }

  /** Models or provider access changed on the server: the option list follows. */
  async #refreshCatalog(): Promise<void> {
    try {
      const [models, access] = await Promise.all([this.#conn.models(), this.#conn.access()])
      if (this.#closed) return
      this.#catalog = { ...this.#catalog, models, access }
      this.#options = buildOptionDescriptors(this.#catalog, this.#sel)
      this.#emit({ kind: K.options, options: this.#options })
    } catch (e) {
      this.#log.warn(`opencode chat ${this.#ctx.sessionId}: catalog refresh failed`, e)
    }
  }

  #onServerExit(code: number | null): void {
    if (this.#closed) return
    this.#closed = true
    this.#detach()
    const tail = this.#conn.server.outputTail()
    this.#emit({
      kind: K.error,
      code: ERROR_CODE.process_exited,
      message: SERVER_EXITED_KEY,
      ...(tail ? { detail: tail } : {}),
      fatal: true,
    })
    if (this.#turnActive || this.#mapper.turnActive) this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    this.#emit({ kind: K.sessionExit, exitCode: code, reason: SESSION_EXIT_REASON.crashed })
  }

  #detach(): void {
    for (const u of this.#unsubscribe.splice(0)) u()
    this.#subagents.dispose()
    this.#lease.release()
  }

  // ── handle ──────────────────────────────────────────────────────────────

  describeOptions(): ChatOptionDescriptor[] {
    return this.#options
  }

  async setOption(key: string, value: ChatOptionValue): Promise<void> {
    const effective: Selection = { ...this.#sel, model: this.#sel.model ?? this.#currentModel() }
    const next = applyOption(effective, key, value, this.#options)
    const sessionID = this.externalSessionId
    const model = modelInputOf(next)
    if (key === AGENT_OPTION_KEY && next.agent)
      await this.#conn.client.session.switchAgent({ sessionID, agent: next.agent })
    else if (MODEL_OPTION_KEYS.has(key) && model) await this.#conn.client.session.switchModel({ sessionID, model })
    this.#sel = next
    this.#options = buildOptionDescriptors(this.#catalog, next)
    this.#emit({ kind: K.options, options: this.#options })
    if (this.#autoApprove) for (const { sessionId, mapper } of this.#mappers()) this.#approveAll(sessionId, mapper)
  }

  get #autoApprove(): boolean {
    return this.#sel.permissionMode === PERMISSION_MODE.auto
  }

  /** Auto-approve mode: every pending permission request of `sessionId` is allowed once. */
  #approveAll(sessionId: string, mapper: EventMapper): void {
    for (const requestID of mapper.pendingPermissions)
      void this.#conn.client.permission
        .reply({ sessionID: sessionId, requestID, decision: toDecision(PERMISSION_OPTION.allow_once) })
        .catch(this.#warn)
  }

  #currentModel(): string | undefined {
    const current = this.#options.find((d) => d.key === CHAT_OPTION_KEYS.model)?.current
    return typeof current === 'string' ? current : undefined
  }

  async send(input: ChatUserInput, meta?: ChatSendMeta): Promise<void> {
    const sessionID = this.externalSessionId
    const prompt = toPrompt(input, this.#ctx.worktreePath, existsSync)
    const slash = parseSlash(input.text, this.#commands)
    // A send during a running turn goes to OpenCode's own inbox: delivered at the next step boundary of the same
    // execution (one `execution.succeeded` ends both).
    const busy = this.#turnActive || this.#mapper.turnActive
    this.#turnActive = true
    try {
      if (slash)
        await this.#conn.client.session.command({
          sessionID,
          ...slash,
          ...(prompt.files ? { files: prompt.files } : {}),
        })
      else await this.#prompt(prompt, busy, meta)
    } catch (e) {
      this.#emit({ kind: K.error, code: ERROR_CODE.turn_failed, message: String(e), fatal: false })
      if (!busy) this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    }
  }

  /** `session.prompt`; the user message id it answers is kept for `rewind` / `fork`. */
  async #prompt(prompt: ReturnType<typeof toPrompt>, busy: boolean, meta?: ChatSendMeta): Promise<void> {
    const delivery = busy ? { delivery: this.#busyDelivery } : {}
    const sessionID = this.externalSessionId
    const user = idSchema.safeParse(await this.#conn.client.session.prompt({ sessionID, ...prompt, ...delivery }))
    if (meta && user.success) this.#messageIds.set(meta.messageId, user.data.id)
  }

  /** Mark the turn interrupted, reject pending permissions and cancel pending forms, then interrupt the turn. */
  async interrupt(): Promise<void> {
    this.#mapper.markInterrupted()
    await this.#cancelPending(FORM_CANCEL_MESSAGE.interrupted)
    await this.#conn.client.session.interrupt({ sessionID: this.externalSessionId })
  }

  async #cancelPending(message: string): Promise<void> {
    const { client } = this.#conn
    for (const { sessionId: sessionID, mapper } of this.#mappers()) {
      for (const requestID of mapper.pendingPermissions) {
        mapper.forget(requestID)
        this.#emit({ kind: K.permissionResolved, requestId: requestID, outcome: PERMISSION_OUTCOME.cancelled })
        await client.permission
          .reply({ sessionID, requestID, decision: toDecision(PERMISSION_OPTION.deny) })
          .catch(this.#warn)
      }
      for (const formID of mapper.pendingForms) {
        mapper.forget(formID)
        this.#emit({ kind: K.responseResolved, eventId: formID, outcome: RESPONSE_OUTCOME.cancelled })
        await client.session.form.cancel({ sessionID, formID, message }).catch(this.#warn)
      }
    }
  }

  readonly #warn = (e: unknown) => this.#log.warn(`opencode chat ${this.#ctx.sessionId}: request failed`, e)

  async respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void> {
    const sessionID = this.#ownerOf(requestId, (m) => m.pendingPermissions)
    if (!sessionID) return
    await this.#conn.client.permission.reply({ sessionID, requestID: requestId, decision: toDecision(decision) })
  }

  // ── optional actions ────────────────────────────────────────────────────

  /** OpenCode's id of a transcript message (live ones are mapped at send; history ones are OpenCode's own). */
  #opencodeMessageId(messageId: string): string {
    return this.#messageIds.get(messageId) ?? messageId
  }

  async #stopTurn(): Promise<void> {
    if (this.#turnActive || this.#mapper.turnActive) await this.interrupt()
  }

  /** Reverts the conversation and the files to before `messageId` (`revert.stage` + `commit`). */
  async rewind(messageId: string): Promise<void> {
    await this.#stopTurn()
    const sessionID = this.externalSessionId
    const staged = revertSchema.safeParse(
      await this.#conn.client.session.revert.stage({
        sessionID,
        messageID: this.#opencodeMessageId(messageId),
        files: true,
      }),
    )
    await this.#conn.client.session.revert.commit({ sessionID })
    const files = staged.success ? (staged.data.files ?? []).map((f) => f.file) : []
    this.#emit({ kind: K.custom, type: CUSTOM.notice, data: { notice: NOTICE.reverted, messageId, files } })
  }

  /** Continues in a copy of the conversation (before `messageId`, else all of it); the original stays as it was. */
  async fork(messageId?: string): Promise<void> {
    await this.#stopTurn()
    const from = this.externalSessionId
    const before = messageId ? this.#opencodeMessageId(messageId) : undefined
    const forked = sessionInfoSchema.parse(
      await this.#conn.client.session.fork({ sessionID: from, ...(before ? { before } : {}) }),
    )
    this.#sessionId = forked.id
    this.#subscribeRoot()
    this.#emitSessionInfo()
    this.#emit({ kind: K.custom, type: CUSTOM.notice, data: { notice: NOTICE.forked, from, to: forked.id } })
  }

  /** The server's MCP servers (`refreshMcp`). */
  async listMcp(): Promise<ChatMcpServer[]> {
    const raw = await this.#conn.client.mcp.list()
    return listOf(mcpServerSchema)
      .parse(raw)
      .data.map((m) => ({
        name: m.name,
        status: MCP_STATUS_OF[m.status.status] ?? MCP_STATUS.failed,
        ...(m.status.error ? { error: m.status.error } : {}),
      }))
  }

  async toggleMcp(name: string, enabled: boolean): Promise<void> {
    if (enabled) await this.#conn.client.mcp.connect({ server: name })
    else await this.#conn.client.mcp.disconnect({ server: name })
    await this.#emitMcp()
  }

  async reconnectMcp(name: string): Promise<void> {
    await this.#conn.client.mcp.connect({ server: name })
    await this.#emitMcp()
  }

  async #emitMcp(): Promise<void> {
    try {
      const servers = await this.listMcp()
      if (!this.#closed) this.#emit({ kind: K.mcpStatus, servers })
    } catch (e) {
      this.#log.warn(`opencode chat ${this.#ctx.sessionId}: mcp list failed`, e)
    }
  }

  /** Interrupts a running subagent's child session. */
  async stopTask(taskId: string): Promise<void> {
    if (!this.#subagents.has(taskId)) return
    await this.#conn.client.session.interrupt({ sessionID: taskId })
  }

  /** §10.3: answer (or skip with `{cancel:true}`) a pending OpenCode form. */
  async respond(eventId: string, payload: unknown): Promise<void> {
    const fields = this.#forms.get(eventId)
    const sessionID = this.#ownerOf(eventId, (m) => m.pendingForms)
    const response = fields && sessionID ? parseFormResponse(fields, payload) : null
    if (!response || !sessionID) throw new Error(INVALID_FORM_ANSWER)
    if ('cancel' in response) await this.#conn.client.session.form.cancel({ sessionID, formID: eventId })
    else await this.#conn.client.session.form.reply({ sessionID, formID: eventId, answer: response.answer })
  }

  /** Cancels pending interactions, stops a running turn, releases the server; the OpenCode session is kept. */
  async close(): Promise<void> {
    if (this.#closed) return
    await this.#cancelPending(FORM_CANCEL_MESSAGE.closed)
    if (this.#turnActive || this.#mapper.turnActive) {
      this.#mapper.markInterrupted()
      await this.#conn.client.session.interrupt({ sessionID: this.externalSessionId }).catch(this.#warn)
    }
    if (this.#closed) return
    this.#closed = true
    this.#detach()
    this.#emit({ kind: K.sessionExit, exitCode: null, reason: SESSION_EXIT_REASON.closed })
  }
}
