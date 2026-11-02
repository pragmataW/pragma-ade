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
  messagePageSchema,
  type OpencodeCommand,
  parseV2Event,
  type SessionInfo,
  sessionInfoSchema,
} from './schemas'
import type { ConnectionPool, OpencodeConnection } from './server/connection'
import type { Lease } from './server/pool'
import type { HubEvent } from './wire/event-hub'

type Log = Pick<Logger, 'info' | 'warn'>
const [SUCCEEDED, FAILED] = IDLE_OUTCOMES

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
    this.#mapper = new EventMapper({ contextWindow: (ref) => contextWindowOf(o.catalog.models, ref) })
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
    const raw = await conn.client.session.get({ sessionID }).catch(() => {
      throw new ChatStartupError(REASON.exitedEarly, SESSION_NOT_FOUND)
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
    if (e.kind === K.custom && e.type === CUSTOM.form && e.eventId) {
      const form = formPayloadSchema.safeParse(e.data)
      if (form.success) this.#forms.set(e.eventId, form.data.fields)
    }
    if (e.kind === K.responseResolved) this.#forms.delete(e.eventId)
    this.#ctx.emit(e)
  }

  #onEvent(e: HubEvent): void {
    if (this.#closed) return
    for (const out of this.#mapper.map(e)) this.#emit(out)
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
    else if (key !== AGENT_OPTION_KEY && model) await this.#conn.client.session.switchModel({ sessionID, model })
    this.#sel = next
    this.#options = buildOptionDescriptors(this.#catalog, next)
    this.#emit({ kind: K.options, options: this.#options })
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
    const sessionID = this.externalSessionId
    const { client } = this.#conn
    for (const requestID of this.#mapper.pendingPermissions) {
      this.#mapper.forget(requestID)
      this.#emit({ kind: K.permissionResolved, requestId: requestID, outcome: PERMISSION_OUTCOME.cancelled })
      await client.permission
        .reply({ sessionID, requestID, decision: toDecision(PERMISSION_OPTION.deny) })
        .catch(this.#warn)
    }
    for (const formID of this.#mapper.pendingForms) {
      this.#mapper.forget(formID)
      this.#emit({ kind: K.responseResolved, eventId: formID, outcome: RESPONSE_OUTCOME.cancelled })
      await client.session.form.cancel({ sessionID, formID, message }).catch(this.#warn)
    }
  }

  readonly #warn = (e: unknown) => this.#log.warn(`opencode chat ${this.#ctx.sessionId}: request failed`, e)

  async respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void> {
    if (!this.#mapper.pendingPermissions.includes(requestId)) return
    await this.#conn.client.permission.reply({
      sessionID: this.externalSessionId,
      requestID: requestId,
      decision: toDecision(decision),
    })
  }

  /** §10.3: answer (or skip with `{cancel:true}`) a pending OpenCode form. */
  async respond(eventId: string, payload: unknown): Promise<void> {
    const fields = this.#forms.get(eventId)
    const response = fields && this.#mapper.pendingForms.includes(eventId) ? parseFormResponse(fields, payload) : null
    if (!response) throw new Error(INVALID_FORM_ANSWER)
    const sessionID = this.externalSessionId
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
