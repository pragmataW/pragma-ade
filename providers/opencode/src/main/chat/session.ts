import { existsSync } from 'node:fs'
import {
  CHAT_OPTION_KEYS,
  type ChatEvent,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatSessionContext,
  type ChatSessionHandle,
  ChatStartupError,
  type ChatUserInput,
  ERROR_CODE,
  EVENT_KIND as K,
  PERMISSION_OPTION,
  PERMISSION_OUTCOME,
  RESPONSE_OUTCOME,
  RESUME_REASON,
  SESSION_EXIT_REASON,
  TURN_END_REASON,
} from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import { CUSTOM, type FormField, formPayloadSchema } from '../../renderer/chat/payloads'
import {
  AGENT_OPTION_KEY,
  EV,
  FORM_CANCEL_MESSAGE,
  IDLE_OUTCOMES,
  INVALID_FORM_ANSWER,
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
  modelValue,
  type Selection,
} from './mapping/options'
import {
  agentInfoSchema,
  commandSchema,
  defaultModelSchema,
  listOf,
  type ModelRef,
  messagePageSchema,
  type OpencodeCommand,
  parseV2Event,
  type SessionInfo,
  sessionInfoSchema,
} from './schemas'
import type { ConnectionPool, OpencodeConnection } from './server/connection'
import type { Lease } from './server/pool'
import { SubagentTracker } from './subagents'
import type { HubEvent } from './wire/event-hub'

type Log = Pick<Logger, 'info' | 'warn'>
const [SUCCEEDED, FAILED] = IDLE_OUTCOMES
/** Options that change the session's model (`switchModel`). */
const MODEL_OPTION_KEYS = new Set<string>([CHAT_OPTION_KEYS.model, CHAT_OPTION_KEYS.effort])

async function loadCatalog(conn: OpencodeConnection): Promise<{ catalog: Catalog; commands: OpencodeCommand[] }> {
  const { client } = conn
  const [models, def, agents, commands] = await Promise.all([
    conn.models(),
    client.model.default(),
    client.agent.list(),
    client.command.list(),
  ])
  return {
    catalog: {
      models,
      defaultModel: defaultModelSchema.parse(def).data,
      agents: listOf(agentInfoSchema).parse(agents).data,
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
  readonly #catalog: Catalog
  readonly #commands: string[]
  readonly #forms = new Map<string, FormField[]>()
  readonly #unsubscribe: (() => void)[] = []
  #sel: Selection
  #options: ChatOptionDescriptor[]
  #turnActive = false
  #closed = false
  readonly externalSessionId: string

  private constructor(o: {
    ctx: ChatSessionContext
    lease: Lease<OpencodeConnection>
    log: Log
    catalog: Catalog
    commands: OpencodeCommand[]
    info: SessionInfo
    sel: Selection
  }) {
    this.#ctx = o.ctx
    this.#lease = o.lease
    this.#conn = o.lease.resource
    this.#log = o.log
    this.#catalog = o.catalog
    this.#commands = o.commands.map((c) => c.name)
    this.#sel = o.sel
    this.#options = buildOptionDescriptors(o.catalog, o.sel)
    this.externalSessionId = o.info.id
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
  static async start(ctx: ChatSessionContext, pool: ConnectionPool, log: Log): Promise<OpencodeChatSession> {
    const lease = await pool.acquire(ctx)
    try {
      const conn = lease.resource
      const { catalog, commands } = await loadCatalog(conn).catch((e: unknown) => {
        throw new ChatStartupError(REASON.infoFailed, String(e))
      })
      const opened = ctx.resumeExternalSessionId
        ? await OpencodeChatSession.#resume(conn, ctx, catalog)
        : await OpencodeChatSession.#create(conn, ctx, catalog)
      const session = new OpencodeChatSession({ ctx, lease, log, catalog, commands, ...opened })
      session.#attach(commands)
      return session
    } catch (e) {
      lease.release()
      throw e
    }
  }

  static async #create(conn: OpencodeConnection, ctx: ChatSessionContext, catalog: Catalog) {
    const sel = withInitialOptions({}, catalog, ctx.initialOptions)
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

  #attach(commands: OpencodeCommand[]): void {
    const { hub } = this.#conn
    this.#unsubscribe.push(
      hub.subscribe(this.externalSessionId, (e) => this.#onEvent(e)),
      hub.onReconnect(() => void this.#resync()),
      this.#conn.onExit((code) => this.#onServerExit(code)),
    )
    this.#emit({
      kind: K.sessionInfo,
      externalSessionId: this.externalSessionId,
      commands: commands.map((c) => ({ name: c.name, description: c.description ?? '' })),
    })
    this.#emit({ kind: K.options, options: this.#options })
  }

  // ── events ──────────────────────────────────────────────────────────────

  #emit(e: ChatEvent): void {
    if (e.kind === K.turnEnd) this.#turnActive = false
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

  async send(input: ChatUserInput): Promise<void> {
    const sessionID = this.externalSessionId
    const prompt = toPrompt(input, this.#ctx.worktreePath, existsSync)
    const slash = parseSlash(input.text, this.#commands)
    this.#turnActive = true
    try {
      if (slash)
        await this.#conn.client.session.command({
          sessionID,
          ...slash,
          ...(prompt.files ? { files: prompt.files } : {}),
        })
      else await this.#conn.client.session.prompt({ sessionID, ...prompt })
    } catch (e) {
      this.#emit({ kind: K.error, code: ERROR_CODE.turn_failed, message: String(e), fatal: false })
      this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    }
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
