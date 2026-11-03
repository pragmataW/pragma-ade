import {
  type ChatErrorCode,
  type ChatEvent,
  ERROR_CODE,
  EVENT_KIND as K,
  RATE_LIMIT_STATUS,
  RESPONSE_OUTCOME,
  TEXT_MODE,
  TODO_STATUS,
  TOOL_STATUS,
  TURN_END_REASON,
} from '@pragma/module-chat/contract'
import { CUSTOM } from '../../../renderer/chat/payloads'
import {
  AUTH_ERROR_RE,
  CONTENT_TYPES,
  ERROR_TYPE_HINTS,
  EV,
  HTTP_STATUS,
  NEWLINE,
  PART_ID_SEPARATOR,
  PART_KIND,
  TOOL_OUTPUT_MAX_CHARS,
} from '../constants'
import type { ModelRef, OpencodeTodo, StructuredError, Tokens, ToolContent, ToolMetadata, V2EventOf } from '../schemas'
import type { HubEvent } from '../wire/event-hub'
import { changeOf, patchToHunks } from './diff'
import { outcomeOf, permissionOptions } from './input'
import { toolKindOf, toolTitleOf } from './tool-kind'

type ToolResultStatus = typeof TOOL_STATUS.completed | typeof TOOL_STATUS.error

/** A finished tool (live `session.tool.success|failed` or a history `tool` content item). */
export interface SettledTool {
  toolCallId: string
  status: ToolResultStatus
  content?: ToolContent[]
  error?: StructuredError
  metadata?: ToolMetadata
}

const TODO_STATUSES: Record<OpencodeTodo['status'], (typeof TODO_STATUS)[keyof typeof TODO_STATUS]> = {
  pending: TODO_STATUS.pending,
  in_progress: TODO_STATUS.active,
  completed: TODO_STATUS.done,
  cancelled: TODO_STATUS.done,
}

function outputOf(content: ToolContent[] = []): { output?: string; outputTruncated?: boolean } {
  const text = content.flatMap((c) => (c.type === CONTENT_TYPES.text ? [c.text] : [])).join(NEWLINE)
  if (!text) return {}
  if (text.length <= TOOL_OUTPUT_MAX_CHARS) return { output: text }
  return { output: text.slice(0, TOOL_OUTPUT_MAX_CHARS), outputTruncated: true }
}

/** `tool-result`, then one `file-edit` per changed file, then the todo list (shared by live and history). */
export function settleTool(t: SettledTool): ChatEvent[] {
  const result: ChatEvent = {
    kind: K.toolResult,
    toolCallId: t.toolCallId,
    status: t.status,
    ...outputOf(t.content),
    ...(t.error ? { error: t.error.message } : {}),
  }
  const edits: ChatEvent[] = (t.metadata?.files ?? []).map((f) => ({
    kind: K.fileEdit,
    toolCallId: t.toolCallId,
    path: f.file,
    change: changeOf(f.status),
    hunks: patchToHunks(f.patch),
  }))
  const todos = t.metadata?.todos
  const todo: ChatEvent[] = todos
    ? [
        {
          kind: K.todo,
          toolCallId: t.toolCallId,
          items: todos.map((x, i) => ({ id: String(i), text: x.content, status: TODO_STATUSES[x.status] })),
        },
      ]
    : []
  return [result, ...edits, ...todo]
}

/** `auth` for 401/403 or an auth-like type (`provider.auth`, `api_key_expired`), `rate_limit` for 429 or a RateLimit* type, else `turn_failed`. */
export function errorCodeOf(e: StructuredError): ChatErrorCode {
  if (e.status === HTTP_STATUS.unauthorized || e.status === HTTP_STATUS.forbidden) return ERROR_CODE.auth
  if (AUTH_ERROR_RE.test(e.type)) return ERROR_CODE.auth
  if (e.status === HTTP_STATUS.rateLimited || e.type.includes(ERROR_TYPE_HINTS.rateLimit)) return ERROR_CODE.rate_limit
  return ERROR_CODE.turn_failed
}

export const partIdOf = (messageId: string, kind: string, ordinal: number | string): string =>
  [messageId, kind, ordinal].join(PART_ID_SEPARATOR)

/** `usage` from cumulative totals and the last step (context = its input + cache + output). */
export function usageEvent(
  totals: { tokens: Tokens; cost?: number },
  last: { tokens: Tokens; model?: ModelRef } | null,
  contextWindow: (ref: ModelRef) => number | undefined,
): ChatEvent {
  const t = totals.tokens
  const l = last?.tokens
  const window = last?.model ? contextWindow(last.model) : undefined
  return {
    kind: K.usage,
    inputTokens: t.input,
    outputTokens: t.output,
    cacheReadTokens: t.cache.read,
    cacheWriteTokens: t.cache.write,
    ...(totals.cost === undefined ? {} : { costUsd: totals.cost }),
    ...(l ? { contextTokens: l.input + l.cache.read + l.cache.write + l.output } : {}),
    ...(window === undefined ? {} : { contextWindow: window }),
  }
}

/** Event kinds that carry `parentId` (a subagent's output nests under its spawning tool call). */
const NESTABLE = new Set<ChatEvent['kind']>([
  K.textDelta,
  K.thinking,
  K.toolCall,
  K.fileEdit,
  K.todo,
  K.permissionRequest,
  K.error,
  K.task,
])
export const nestUnder = (e: ChatEvent, parentId: string | undefined): ChatEvent =>
  parentId && NESTABLE.has(e.kind) ? ({ ...e, parentId } as ChatEvent) : e

type TextEvent = V2EventOf<
  typeof EV.textDelta | typeof EV.textEnded | typeof EV.reasoningDelta | typeof EV.reasoningEnded
>

/** Live translation of one session's v2 events into chat events (stateful: tools, last step, pending interactions). */
export class EventMapper {
  readonly #contextWindow: (ref: ModelRef) => number | undefined
  readonly #parentId: string | undefined
  readonly #tools = new Map<string, { name: string; input: Record<string, unknown> }>()
  readonly #permissions = new Set<string>()
  readonly #forms = new Set<string>()
  #model: ModelRef | undefined
  #lastStep: { tokens: Tokens; model?: ModelRef } | null = null
  #turnActive = false
  #stepFailed = false
  /** The last step error of the turn (`execution.failed` repeats it: shown once). */
  #stepError: string | undefined
  #interrupted = false
  #rateLimited = false
  readonly #now: () => number

  /** `parentId`: this mapper translates a subagent's session; its output nests under that tool call. */
  constructor(o: { contextWindow: (ref: ModelRef) => number | undefined; parentId?: string; now?: () => number }) {
    this.#contextWindow = o.contextWindow
    this.#parentId = o.parentId
    this.#now = o.now ?? Date.now
  }

  /** The model of the last step (provider auth errors name it). */
  get model(): ModelRef | undefined {
    return this.#model
  }

  get turnActive(): boolean {
    return this.#turnActive
  }
  get pendingPermissions(): string[] {
    return [...this.#permissions]
  }
  get pendingForms(): string[] {
    return [...this.#forms]
  }

  /** The user stopped the turn: whatever ends it next (`succeeded`/`failed`) ends it as interrupted. */
  markInterrupted(): void {
    this.#interrupted = true
  }

  /** Forget a pending interaction the session resolved itself (cancelled before an interrupt or close). */
  forget(id: string): void {
    this.#permissions.delete(id)
    this.#forms.delete(id)
  }

  map(e: HubEvent): ChatEvent[] {
    return this.#map(e).map((x) => nestUnder(x, this.#parentId))
  }

  #map(e: HubEvent): ChatEvent[] {
    switch (e.type) {
      case EV.connected:
      case EV.inboxEnqueued:
      case EV.sessionCreated:
      case EV.toolProgress:
      case EV.mcpStatusChanged:
      case EV.modelUpdated:
      case EV.providerUpdated:
      case EV.integrationUpdated:
      case EV.credentialUpdated:
        return []
      case EV.executionStarted:
        this.#turnActive = true
        return []
      case EV.stepStarted:
        this.#model = e.data.model
        return []
      case EV.textDelta:
      case EV.textEnded:
      case EV.reasoningDelta:
      case EV.reasoningEnded:
        return [this.#text(e)]
      case EV.toolInputStarted:
        return [this.#toolStarted(e.data.id, e.data.name)]
      case EV.toolCalled:
        return [this.#toolCalled(e.data.id, e.data.input)]
      case EV.toolSuccess:
        return settleTool({ toolCallId: e.data.id, status: TOOL_STATUS.completed, ...e.data })
      case EV.toolFailed:
        return settleTool({ toolCallId: e.data.id, status: TOOL_STATUS.error, ...e.data })
      case EV.permissionAsked:
        return [this.#permission(e)]
      case EV.permissionReplied:
        return this.#resolved(this.#permissions, e.data.requestID, () => ({
          kind: K.permissionResolved,
          requestId: e.data.requestID,
          outcome: outcomeOf(e.data.reply),
        }))
      case EV.formCreated:
        return [this.#form(e)]
      case EV.formReplied:
      case EV.formCancelled:
        return this.#resolved(this.#forms, e.data.id, () => ({
          kind: K.responseResolved,
          eventId: e.data.id,
          outcome: e.type === EV.formReplied ? RESPONSE_OUTCOME.answered : RESPONSE_OUTCOME.cancelled,
        }))
      case EV.retryScheduled:
        return [
          {
            kind: K.retry,
            attempt: Math.max(1, e.data.attempt),
            delayMs: Math.max(0, Math.round(e.data.at - this.#now())),
            reason: e.data.error.message,
          },
        ]
      case EV.stepFailed:
        this.#stepFailed = true
        this.#stepError = e.data.error.message
        return this.#errorEvents(e.data.error)
      case EV.stepEnded:
        this.#lastStep = { tokens: e.data.tokens, model: this.#model }
        return []
      case EV.usageUpdated:
        return [usageEvent(e.data, this.#lastStep, this.#contextWindow)]
      case EV.executionSucceeded:
        return this.#end(this.#succeededReason())
      case EV.executionFailed:
        return this.#failed(e.data.error)
      case EV.executionInterrupted:
        return this.#end(TURN_END_REASON.interrupted)
      default: {
        const never: never = e
        return never
      }
    }
  }

  #text(e: TextEvent): ChatEvent {
    const reasoning = e.type === EV.reasoningDelta || e.type === EV.reasoningEnded
    const delta = e.type === EV.textDelta || e.type === EV.reasoningDelta
    const d = e.data as { assistantMessageID: string; ordinal: number; delta?: string; text?: string }
    return {
      kind: reasoning ? K.thinking : K.textDelta,
      messageId: d.assistantMessageID,
      partId: partIdOf(d.assistantMessageID, reasoning ? PART_KIND.reasoning : PART_KIND.text, d.ordinal),
      text: (delta ? d.delta : d.text) ?? '',
      mode: delta ? TEXT_MODE.delta : TEXT_MODE.snapshot,
    }
  }

  #toolStarted(id: string, name: string): ChatEvent {
    this.#tools.set(id, { name, input: {} })
    return {
      kind: K.toolCall,
      toolCallId: id,
      name,
      toolKind: toolKindOf(name),
      input: {},
      status: TOOL_STATUS.pending,
    }
  }

  #toolCalled(id: string, input: Record<string, unknown>): ChatEvent {
    const name = this.#tools.get(id)?.name ?? ''
    this.#tools.set(id, { name, input })
    const title = toolTitleOf(name, input)
    return {
      kind: K.toolCall,
      toolCallId: id,
      name,
      toolKind: toolKindOf(name),
      ...(title ? { title } : {}),
      input,
      status: TOOL_STATUS.running,
    }
  }

  #permission(e: V2EventOf<typeof EV.permissionAsked>): ChatEvent {
    const d = e.data
    const toolCallId = d.source?.id
    const tool = toolCallId ? this.#tools.get(toolCallId) : undefined
    const toolName = tool?.name || d.action
    const input = tool?.input ?? { resources: d.resources }
    const title = toolTitleOf(toolName, input) ?? d.resources[0] ?? d.action
    const resources = d.resources.join(NEWLINE)
    this.#permissions.add(d.id)
    return {
      kind: K.permissionRequest,
      requestId: d.id,
      ...(toolCallId ? { toolCallId } : {}),
      toolName,
      toolKind: toolKindOf(toolName),
      title,
      ...(d.message || resources !== title ? { detail: d.message ?? resources } : {}),
      input,
      options: permissionOptions(d.save),
    }
  }

  #form(e: V2EventOf<typeof EV.formCreated>): ChatEvent {
    const { id, title, fields } = e.data.form
    this.#forms.add(id)
    return { kind: K.custom, type: CUSTOM.form, data: { formId: id, title, fields }, eventId: id, awaitsResponse: true }
  }

  #succeededReason() {
    if (this.#interrupted) return TURN_END_REASON.interrupted
    return this.#stepFailed ? TURN_END_REASON.error : TURN_END_REASON.completed
  }

  #resolved(pending: Set<string>, id: string, event: () => ChatEvent): ChatEvent[] {
    if (!pending.delete(id)) return []
    return [event()]
  }

  #failed(error: StructuredError): ChatEvent[] {
    if (this.#interrupted) return this.#end(TURN_END_REASON.interrupted)
    const repeated = error.message === this.#stepError
    return [...(repeated ? [] : this.#errorEvents(error)), ...this.#end(TURN_END_REASON.error)]
  }

  /** The error row; a rate limit also raises the kit's banner (with the reset time when OpenCode knows it). */
  #errorEvents(error: StructuredError): ChatEvent[] {
    const code = errorCodeOf(error)
    const err: ChatEvent = { kind: K.error, code, message: error.message, fatal: false }
    if (code !== ERROR_CODE.rate_limit) return [err]
    this.#rateLimited = true
    const resetsAt = error.retryAfterMs === undefined ? undefined : this.#now() + error.retryAfterMs
    return [
      err,
      {
        kind: K.rateLimit,
        status: RATE_LIMIT_STATUS.rejected,
        message: error.message,
        ...(resetsAt === undefined ? {} : { resetsAt }),
      },
    ]
  }

  #end(reason: (typeof TURN_END_REASON)[keyof typeof TURN_END_REASON]): ChatEvent[] {
    const cleared: ChatEvent[] =
      this.#rateLimited && reason === TURN_END_REASON.completed
        ? [{ kind: K.rateLimit, status: RATE_LIMIT_STATUS.cleared }]
        : []
    if (cleared.length) this.#rateLimited = false
    return [...cleared, ...this.#endTurn(reason)]
  }

  #endTurn(reason: (typeof TURN_END_REASON)[keyof typeof TURN_END_REASON]): ChatEvent[] {
    this.#turnActive = false
    this.#stepFailed = false
    this.#stepError = undefined
    this.#interrupted = false
    this.#permissions.clear()
    this.#forms.clear()
    this.#tools.clear()
    return [{ kind: K.turnEnd, reason }]
  }
}
