import { randomUUID } from 'node:crypto'
import {
  type CanUseTool,
  type PermissionMode,
  type PermissionResult,
  type PermissionUpdate,
  type Query,
  query,
  type SDKControlInitializeResponse,
} from '@anthropic-ai/claude-agent-sdk'
import {
  CHAT_OPTION_KEYS,
  type ChatEvent,
  type ChatMcpServer,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatPermissionOutcome,
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
  type SESSION_EXIT_REASONS,
  TURN_END_REASON,
  UNSUPPORTED_REASON,
  validateOptionValue,
} from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import {
  ABORT_EVENT,
  BEHAVIOR,
  CLAUDE_TOOLS,
  DENY_MESSAGE,
  ENOENT,
  FAST_MODE_OPTION,
  NO_CONVERSATION_RE,
  PERMISSION_CANCELLED_MESSAGE,
  REWIND_FAILED,
  SDK_SETTING_EFFORT,
  SDK_SETTING_FAST_MODE,
} from './constants'
import { createSdkMessageMapper, type SdkMessageMapper } from './mapper'
import { toMcpServer } from './notices'
import {
  buildQueryOptions,
  type ClaudeOptionState,
  describeClaudeOptions,
  initialOptionState,
  planModes,
  splitPermissionArgs,
} from './options'
import { answerPlan, answerQuestion, PROMPT_TOOLS, type PromptOutcome, promptEvent } from './prompts'
import { type ClaudeProcessSpawn, createClaudeProcessSpawn, type SpawnDeps } from './spawn'
import { toolKindFor, toolTitleFor } from './tool-kinds'
import { createUserInputQueue, toSdkUserMessage, type UserInputQueue } from './user-input'

export interface ClaudeSessionDeps {
  log?: Pick<Logger, 'info' | 'warn'>
  spawn?: SpawnDeps
  query?: typeof query
}

export class InvalidOptionError extends Error {}

interface PendingPermission {
  resolve(result: PermissionResult): void
  input: Record<string, unknown>
  suggestions?: PermissionUpdate[]
}

/** An `AskUserQuestion` / `ExitPlanMode` call waiting for its card's `respond`. */
interface PendingPrompt {
  resolve(result: PermissionResult): void
  answer(payload: unknown): PromptOutcome
}

export class UnknownPromptError extends Error {}

type ExitReason = (typeof SESSION_EXIT_REASONS)[number]
const TIMEOUT = Symbol('timeout')
/** After a rejected handshake, how long to wait for the exit status before classifying the failure. */
const EXIT_SETTLE_MS = 500

const asText = (v: ChatOptionValue): string | null => (typeof v === 'string' ? v : null)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref())
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const OUTCOME_OF: Record<ChatPermissionDecision, ChatPermissionOutcome> = {
  [PERMISSION_OPTION.allow_once]: PERMISSION_OUTCOME.allowed,
  [PERMISSION_OPTION.allow_always]: PERMISSION_OUTCOME.allowed_always,
  [PERMISSION_OPTION.deny]: PERMISSION_OUTCOME.denied,
}

function permissionResult(outcome: ChatPermissionOutcome, p: PendingPermission): PermissionResult {
  switch (outcome) {
    case PERMISSION_OUTCOME.allowed:
      return { behavior: BEHAVIOR.allow, updatedInput: p.input }
    case PERMISSION_OUTCOME.allowed_always:
      return { behavior: BEHAVIOR.allow, updatedInput: p.input, updatedPermissions: p.suggestions ?? [] }
    case PERMISSION_OUTCOME.denied:
      return { behavior: BEHAVIOR.deny, message: DENY_MESSAGE }
    case PERMISSION_OUTCOME.cancelled:
      return { behavior: BEHAVIOR.deny, message: PERMISSION_CANCELLED_MESSAGE }
    default: {
      const never: never = outcome
      return never
    }
  }
}

/** One Claude Code process driven through the Agent SDK (`query()` with streaming input and a custom spawn). */
export class ClaudeChatSession implements ChatSessionHandle {
  readonly externalSessionId: string
  readonly #ctx: ChatSessionContext
  readonly #log?: ClaudeSessionDeps['log']
  readonly #spawner: ClaudeProcessSpawn
  readonly #queue: UserInputQueue = createUserInputQueue()
  readonly #abort = new AbortController()
  readonly #mapper: SdkMessageMapper = createSdkMessageMapper()
  readonly #pending = new Map<string, PendingPermission>()
  readonly #prompts = new Map<string, PendingPrompt>()
  readonly #q: Query
  #state: ClaudeOptionState
  #init: Pick<SDKControlInitializeResponse, 'models' | 'commands'> = { models: [], commands: [] }
  #turnActive = false
  #mcpShown = false
  #closing = false
  #ended = false

  /** Spawns the CLI and resolves after the `initialize` handshake; rejects with `ChatStartupError`. */
  static async start(ctx: ChatSessionContext, deps: ClaudeSessionDeps = {}): Promise<ClaudeChatSession> {
    const session = new ClaudeChatSession(ctx, deps)
    await session.#handshake()
    return session
  }

  private constructor(ctx: ChatSessionContext, deps: ClaudeSessionDeps) {
    this.#ctx = ctx
    this.#log = deps.log
    this.externalSessionId = ctx.resumeExternalSessionId ?? randomUUID()
    this.#spawner = createClaudeProcessSpawn(
      // the profile's permission flag is the start mode only (`permissionMode`): kept off the CLI args
      { command: ctx.profile.command, prefixArgs: splitPermissionArgs(ctx.profile.args).args },
      deps.spawn,
    )
    this.#state = initialOptionState(ctx)
    const options = buildQueryOptions(ctx, this.#spawner, this.#canUseTool, this.#abort, this.externalSessionId)
    this.#q = (deps.query ?? query)({ prompt: this.#queue.messages, options })
  }

  async #handshake(): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<typeof TIMEOUT>((r) => {
      timer = setTimeout(() => r(TIMEOUT), this.#ctx.startupTimeoutMs)
    })
    let outcome: SDKControlInitializeResponse | typeof TIMEOUT | Error
    try {
      outcome = await Promise.race([this.#q.initializationResult(), timeout])
    } catch (e) {
      outcome = e instanceof Error ? e : new Error(String(e))
    } finally {
      clearTimeout(timer)
    }
    if (outcome !== TIMEOUT && !(outcome instanceof Error)) return this.#ready(outcome)
    const error = await this.#startupError(outcome)
    this.#queue.end()
    this.#spawner.kill(true)
    this.#q.close()
    this.#log?.warn(`claude chat ${this.#ctx.sessionId}: startup failed (${error.message})`)
    throw error
  }

  async #startupError(outcome: typeof TIMEOUT | Error): Promise<ChatStartupError> {
    const command = this.#ctx.profile.command
    if (outcome !== TIMEOUT) await Promise.race([this.#spawner.exited(), sleep(EXIT_SETTLE_MS)])
    if (this.#spawner.spawnError()?.code === ENOENT)
      return new ChatStartupError(UNSUPPORTED_REASON.commandNotFound, command)
    const tail = this.#spawner.stderrTail()
    const exit = this.#spawner.exitInfo()
    if (exit) return this.#exitedError(`exit ${exit.code ?? exit.signal}: ${tail}`, tail)
    const detail = tail || (outcome === TIMEOUT ? undefined : outcome.message)
    return new ChatStartupError(UNSUPPORTED_REASON.noProtocol, detail)
  }

  /** An early exit while resuming is a failed resume (not an "unsupported" verdict); no conversation → `notFound`. */
  #exitedError(detail: string, stderr: string): ChatStartupError {
    if (!this.#ctx.resumeExternalSessionId) return new ChatStartupError(UNSUPPORTED_REASON.exitedEarly, detail)
    const reason = NO_CONVERSATION_RE.test(stderr) ? RESUME_REASON.notFound : RESUME_REASON.failed
    return new ChatStartupError(reason, detail)
  }

  #ready(init: SDKControlInitializeResponse): void {
    this.#init = init
    this.#log?.info(`claude chat ${this.#ctx.sessionId}: ready (session ${this.externalSessionId})`)
    const commands = (init.commands ?? []).map((c) => ({
      name: c.name,
      description: c.description,
      ...(c.argumentHint ? { argumentHint: c.argumentHint } : {}),
    }))
    this.#ctx.emit({ kind: K.sessionInfo, externalSessionId: this.externalSessionId, commands })
    this.#emitOptions()
    if (this.#state.fastMode) void this.#flags({ [SDK_SETTING_FAST_MODE]: true }).catch(() => undefined)
    void this.#refreshMcp()
    void this.#pump()
  }

  async #pump(): Promise<void> {
    try {
      for await (const message of this.#q) for (const e of this.#mapper.map(message)) this.#emit(e)
      if (!this.#closing) await this.#crash(undefined)
    } catch (e) {
      if (!this.#closing) await this.#crash(e)
    }
  }

  /** One event the host refuses (e.g. it fails the contract) is logged and skipped: never a process crash. */
  #emit(e: ChatEvent): void {
    if (e.kind === K.turnEnd) this.#turnActive = false
    if (e.kind === K.turnStart) this.#turnActive = true
    try {
      this.#ctx.emit(e)
    } catch (error) {
      this.#log?.warn(`claude chat ${this.#ctx.sessionId}: ${e.kind} event dropped (${errorMessage(error)})`)
      return
    }
    // `system/init` lists names and states only: follow it with the detailed list
    if (e.kind === K.mcpStatus) void this.#refreshMcp()
  }

  async #crash(error: unknown): Promise<void> {
    if (this.#ended) return
    await Promise.race([this.#spawner.exited(), sleep(EXIT_SETTLE_MS)])
    const exit = this.#spawner.exitInfo()
    const message = error === undefined ? `exit ${exit?.code ?? exit?.signal ?? ''}` : errorMessage(error)
    this.#log?.warn(`claude chat ${this.#ctx.sessionId}: process ended (${message})`)
    this.#cancelPending()
    const detail = this.#spawner.stderrTail()
    this.#ctx.emit({
      kind: K.error,
      code: ERROR_CODE.process_exited,
      message,
      ...(detail ? { detail } : {}),
      fatal: true,
    })
    if (this.#turnActive) this.#emit({ kind: K.turnEnd, reason: TURN_END_REASON.error })
    this.#queue.end()
    this.#emitExit(SESSION_EXIT_REASON.crashed, exit?.code ?? null)
  }

  #emitExit(reason: ExitReason, exitCode: number | null): void {
    if (this.#ended) return
    this.#ended = true
    this.#ctx.emit({ kind: K.sessionExit, exitCode, reason })
  }

  #emitOptions(): void {
    this.#ctx.emit({ kind: K.options, options: this.describeOptions() })
  }

  readonly #canUseTool: CanUseTool = (toolName, input, o) =>
    new Promise((resolve) => {
      const requestId = o.requestId ?? o.toolUseID
      if (PROMPT_TOOLS.has(toolName)) return this.#prompt(toolName, requestId, input, o.signal, resolve)
      this.#pending.set(requestId, { resolve, input, suggestions: o.suggestions })
      o.signal.addEventListener(ABORT_EVENT, () => this.#resolvePending(requestId, PERMISSION_OUTCOME.cancelled), {
        once: true,
      })
      const detail = o.decisionReason ?? o.blockedPath
      const options = o.suggestions?.length
        ? [PERMISSION_OPTION.allow_once, PERMISSION_OPTION.allow_always, PERMISSION_OPTION.deny]
        : [PERMISSION_OPTION.allow_once, PERMISSION_OPTION.deny]
      this.#ctx.emit({
        kind: K.permissionRequest,
        requestId,
        toolCallId: o.toolUseID,
        toolName,
        toolKind: toolKindFor(toolName),
        title: toolTitleFor(toolName, input) ?? toolName,
        ...(detail ? { detail } : {}),
        input,
        options,
      })
    })

  #resolvePending(requestId: string, outcome: ChatPermissionOutcome): void {
    const p = this.#pending.get(requestId)
    if (!p) return
    this.#pending.delete(requestId)
    p.resolve(permissionResult(outcome, p))
    this.#ctx.emit({ kind: K.permissionResolved, requestId, outcome })
  }

  #cancelPending(): void {
    for (const id of [...this.#pending.keys()]) this.#resolvePending(id, PERMISSION_OUTCOME.cancelled)
    for (const id of [...this.#prompts.keys()]) this.#cancelPrompt(id)
  }

  /** A question or plan card; its `respond` resolves the tool call (cancelled on abort, interrupt and close). */
  #prompt(
    toolName: string,
    eventId: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
    resolve: (r: PermissionResult) => void,
  ): void {
    const answer = toolName === CLAUDE_TOOLS.askUserQuestion ? answerQuestion : answerPlan
    this.#prompts.set(eventId, { resolve, answer: (payload) => answer(input, payload) })
    signal.addEventListener(ABORT_EVENT, () => this.#cancelPrompt(eventId), { once: true })
    this.#ctx.emit(promptEvent(toolName, eventId, input, planModes(this.describeOptions())))
  }

  #cancelPrompt(eventId: string): void {
    const p = this.#prompts.get(eventId)
    if (!p) return
    this.#prompts.delete(eventId)
    p.resolve({ behavior: BEHAVIOR.deny, message: PERMISSION_CANCELLED_MESSAGE })
    this.#ctx.emit({ kind: K.responseResolved, eventId, outcome: RESPONSE_OUTCOME.cancelled })
  }

  /** Answers a question / plan card; rejects on an unknown id or an invalid payload (the card stays open). */
  async respond(eventId: string, payload: unknown): Promise<void> {
    const p = this.#prompts.get(eventId)
    if (!p) throw new UnknownPromptError(`no pending prompt ${eventId}`)
    const outcome = p.answer(payload)
    this.#prompts.delete(eventId)
    p.resolve(outcome.result)
    const summary = outcome.summary ? { summary: outcome.summary } : {}
    this.#ctx.emit({ kind: K.responseResolved, eventId, outcome: RESPONSE_OUTCOME.answered, ...summary })
    if (outcome.mode) await this.#applyPermissionMode(outcome.mode)
  }

  async #applyPermissionMode(mode: PermissionMode): Promise<void> {
    await this.#q.setPermissionMode(mode)
    this.#state = { ...this.#state, permissionMode: mode }
    this.#emitOptions()
  }

  describeOptions(): ChatOptionDescriptor[] {
    return describeClaudeOptions(this.#init, this.#state)
  }

  async setOption(key: string, value: ChatOptionValue): Promise<void> {
    const d = this.describeOptions().find((o) => o.key === key)
    if (!d || !validateOptionValue(d, value)) throw new InvalidOptionError(`invalid option ${key}=${String(value)}`)
    await this.#appliers[key]?.(value)
    this.#state = { ...this.#state, [key]: key === FAST_MODE_OPTION ? value === true : asText(value) }
    this.#emitOptions()
  }

  /** How each option reaches the CLI. */
  readonly #appliers: Record<string, (value: ChatOptionValue) => Promise<void>> = {
    [CHAT_OPTION_KEYS.model]: (v) => this.#q.setModel(asText(v) ?? undefined),
    [CHAT_OPTION_KEYS.effort]: (v) => this.#flags({ [SDK_SETTING_EFFORT]: asText(v) }),
    [CHAT_OPTION_KEYS.permissionMode]: (v) => this.#q.setPermissionMode(asText(v) as PermissionMode),
    [FAST_MODE_OPTION]: (v) => this.#flags({ [SDK_SETTING_FAST_MODE]: v === true }),
  }

  #flags(settings: Record<string, unknown>): Promise<void> {
    return this.#q.applyFlagSettings(settings as Parameters<Query['applyFlagSettings']>[0])
  }

  async send(input: ChatUserInput): Promise<void> {
    this.#turnActive = true
    // the core's message id doubles as the SDK uuid: replays ack it and `rewind` finds it
    const { messageId, ...content } = input
    this.#queue.push(toSdkUserMessage(content, this.externalSessionId, messageId ?? randomUUID()))
  }

  // ── MCP ──────────────────────────────────────────────────────────────────────────────────────────────────
  async listMcp(): Promise<ChatMcpServer[]> {
    return ((await this.#q.mcpServerStatus()) ?? []).map((s) => toMcpServer(s))
  }

  async toggleMcp(name: string, enabled: boolean): Promise<void> {
    await this.#q.toggleMcpServer(name, enabled)
    await this.#refreshMcp()
  }

  async reconnectMcp(name: string): Promise<void> {
    await this.#q.reconnectMcpServer(name)
    await this.#refreshMcp()
  }

  /** Emits the detailed server list (tool counts, errors); an empty list only replaces an earlier one. */
  async #refreshMcp(): Promise<void> {
    const servers = await this.listMcp().catch((e: unknown) => {
      this.#log?.warn(`claude chat ${this.#ctx.sessionId}: mcp status failed (${errorMessage(e)})`)
      return undefined
    })
    if (!servers || (servers.length === 0 && !this.#mcpShown)) return
    this.#mcpShown = true
    this.#ctx.emit({ kind: K.mcpStatus, servers })
  }

  /** Restores the files to before the user message `messageId` (an SDK message uuid; file checkpointing is on). */
  async rewind(messageId: string): Promise<void> {
    const r = await this.#q.rewindFiles(messageId)
    if (!r.canRewind) throw new Error(r.error ?? REWIND_FAILED)
  }

  async interrupt(): Promise<void> {
    this.#cancelPending()
    if (!this.#turnActive || this.#ended) return
    this.#mapper.markInterruptRequested()
    await this.#q.interrupt()
  }

  /** Stops a subagent, workflow or background job (`task_notification` stopped follows). */
  async stopTask(taskId: string): Promise<void> {
    await this.#q.stopTask(taskId)
  }

  async respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void> {
    this.#resolvePending(requestId, OUTCOME_OF[decision])
  }

  async close(): Promise<void> {
    if (this.#ended || this.#closing) return
    this.#closing = true
    this.#cancelPending()
    this.#queue.end()
    this.#q.close()
    // 11c: the exit is reported only once the child is really gone (a switch must never overlap two processes)
    const exit = await this.#spawner.stop()
    this.#emitExit(SESSION_EXIT_REASON.closed, exit?.code ?? null)
  }

  kill(): void {
    this.#spawner.kill(true)
    void this.close()
  }
}
