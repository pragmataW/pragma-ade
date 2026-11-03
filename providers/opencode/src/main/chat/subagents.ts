import {
  type ChatEvent,
  type ChatTaskUsage,
  EVENT_KIND as K,
  TASK_KIND,
  TASK_STATUS,
  TURN_END_REASON,
} from '@pragma/module-chat/contract'
import { CONTENT_TYPES, EV, NEWLINE, SUBAGENT_RESULT_RE, SUBAGENT_TOOLS, TASK_FALLBACK_NAME } from './constants'
import { EventMapper } from './mapping/event-mapper'
import type { ModelRef, ToolContent, V2EventOf } from './schemas'
import type { HubEvent } from './wire/event-hub'

type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]
type TurnEndReason = (typeof TURN_END_REASON)[keyof typeof TURN_END_REASON]

const STATUS_OF_END: Record<TurnEndReason, TaskStatus> = {
  [TURN_END_REASON.completed]: TASK_STATUS.completed,
  [TURN_END_REASON.interrupted]: TASK_STATUS.killed,
  [TURN_END_REASON.error]: TASK_STATUS.failed,
  [TURN_END_REASON.limit]: TASK_STATUS.failed,
}
const LIVE = new Set<TaskStatus>([TASK_STATUS.pending, TASK_STATUS.running])

export interface SubagentDeps {
  /** The tracked session's own id (subagents of it and of its subagents are tracked). */
  rootSessionId: string
  subscribe(sessionId: string, cb: (e: HubEvent) => void): () => void
  emit(e: ChatEvent): void
  contextWindow(ref: ModelRef): number | undefined
  now(): number
}

/** A `subagent` tool call of a tracked session. */
interface SpawnCall {
  owner: string
  input: Record<string, unknown>
  childId?: string
}

/** One child session (a running or finished subagent). */
interface Child {
  id: string
  toolCallId: string
  owner: string
  depth: number
  mapper: EventMapper
  status: TaskStatus
  startedAt: number
  tools: Set<string>
  unsubscribe: () => void
  tokens: number
  costUsd?: number
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/** The subagent's answer from the tool result (`<subagent …>answer</subagent>` → `answer`). */
export function subagentSummary(content: ToolContent[] = []): string | undefined {
  const text = content.flatMap((c) => (c.type === CONTENT_TYPES.text ? [c.text] : [])).join(NEWLINE)
  const inner = SUBAGENT_RESULT_RE.exec(text)?.groups?.body ?? text
  return str(inner.trim())
}

/**
 * Subagents of one chat session: OpenCode's `subagent` tool runs a child session (`session.created{parentID}`,
 * linked by `session.tool.progress{metadata.sessionID}`). Each child becomes a `task` event (upserted with live status,
 * last tool and usage) and its output streams nested under the spawning tool call (`parentId`). Children of children
 * nest the same way (`depth`).
 */
export class SubagentTracker {
  readonly #d: SubagentDeps
  readonly #calls = new Map<string, SpawnCall>()
  readonly #children = new Map<string, Child>()

  constructor(d: SubagentDeps) {
    this.#d = d
  }

  /** Every child mapper (pending permissions and forms of subagents live there). */
  get mappers(): { sessionId: string; mapper: EventMapper }[] {
    return [...this.#children.values()].map((c) => ({ sessionId: c.id, mapper: c.mapper }))
  }

  /** The child session ids that still run. */
  get live(): string[] {
    return [...this.#children.values()].filter((c) => LIVE.has(c.status)).map((c) => c.id)
  }

  has(taskId: string): boolean {
    return this.#children.has(taskId)
  }

  /** Watches an event of a tracked session (the root or a child) for subagent spawns and results. */
  observe(owner: string, e: HubEvent): void {
    switch (e.type) {
      case EV.toolInputStarted:
        if ((SUBAGENT_TOOLS as readonly string[]).includes(e.data.name))
          this.#calls.set(e.data.id, { owner, input: {} })
        return
      case EV.toolCalled:
        this.#updateCall(e.data.id, e.data.input)
        return
      case EV.toolProgress: {
        const childId = e.data.metadata.sessionID
        if (childId) this.#link(e.data.id, childId)
        return
      }
      case EV.sessionCreated:
        if (e.data.parentID === owner) this.#created(owner, e)
        return
      case EV.toolSuccess:
      case EV.toolFailed:
        this.#settled(e)
        return
      default:
        return
    }
  }

  /** The parent turn ended: subagents still running end with it (`killed` when interrupted). */
  endAll(reason: TurnEndReason): void {
    for (const c of this.#children.values())
      if (LIVE.has(c.status))
        this.#update(c, reason === TURN_END_REASON.completed ? TASK_STATUS.completed : TASK_STATUS.killed)
  }

  dispose(): void {
    for (const c of this.#children.values()) c.unsubscribe()
    this.#children.clear()
    this.#calls.clear()
  }

  #updateCall(id: string, input: Record<string, unknown>): void {
    const call = this.#calls.get(id)
    if (!call) return
    call.input = input
    const child = call.childId ? this.#children.get(call.childId) : undefined
    if (child) this.#emitTask(child)
  }

  #created(owner: string, e: V2EventOf<typeof EV.sessionCreated>): void {
    const childId = e.data.sessionID
    if ([...this.#calls.values()].some((c) => c.childId === childId)) return
    const pending = [...this.#calls.entries()].find(([, c]) => c.owner === owner && !c.childId)
    if (!pending) return
    const [toolCallId, call] = pending
    if (!call.input.agent && e.data.agent) call.input = { ...call.input, agent: e.data.agent }
    if (!call.input.description && e.data.title) call.input = { ...call.input, description: e.data.title }
    this.#link(toolCallId, childId)
  }

  #link(toolCallId: string, childId: string): void {
    const call = this.#calls.get(toolCallId)
    if (!call || this.#children.has(childId)) return
    call.childId = childId
    const parent = this.#children.get(call.owner)
    const child: Child = {
      id: childId,
      toolCallId,
      owner: call.owner,
      depth: parent ? parent.depth + 1 : 0,
      mapper: new EventMapper({ contextWindow: this.#d.contextWindow, parentId: toolCallId }),
      status: TASK_STATUS.running,
      startedAt: this.#d.now(),
      tools: new Set(),
      unsubscribe: () => undefined,
      tokens: 0,
    }
    this.#children.set(childId, child)
    child.unsubscribe = this.#d.subscribe(childId, (ev) => this.#onChildEvent(child, ev))
    this.#emitTask(child)
  }

  #onChildEvent(child: Child, e: HubEvent): void {
    this.observe(child.id, e)
    for (const out of child.mapper.map(e)) this.#forward(child, out)
  }

  /** A child's chat event: its turn end and usage become task updates, the rest nests in the transcript. */
  #forward(child: Child, e: ChatEvent): void {
    switch (e.kind) {
      case K.turnEnd:
        this.#update(child, STATUS_OF_END[e.reason])
        return
      case K.usage:
        child.tokens = e.inputTokens + e.outputTokens + e.cacheReadTokens
        if (e.costUsd !== undefined) child.costUsd = e.costUsd
        this.#emitTask(child)
        return
      case K.toolCall:
        child.tools.add(e.toolCallId)
        this.#d.emit(e)
        this.#emitTask(child, e.title ?? e.name)
        return
      default:
        this.#d.emit(e)
    }
  }

  #settled(e: V2EventOf<typeof EV.toolSuccess> | V2EventOf<typeof EV.toolFailed>): void {
    const call = this.#calls.get(e.data.id)
    const childId = call?.childId ?? e.data.metadata?.sessionID
    if (call && !call.childId && childId) this.#link(e.data.id, childId)
    const child = childId ? this.#children.get(childId) : undefined
    if (!child) return
    const summary = e.type === EV.toolSuccess ? subagentSummary(e.data.content) : e.data.error.message
    this.#update(child, e.type === EV.toolSuccess ? TASK_STATUS.completed : TASK_STATUS.failed, summary)
  }

  #update(child: Child, status: TaskStatus, summary?: string): void {
    child.status = status
    this.#emitTask(child, undefined, summary)
  }

  #usage(child: Child): ChatTaskUsage {
    return {
      tokens: child.tokens,
      ...(child.costUsd === undefined ? {} : { costUsd: child.costUsd }),
      toolUses: child.tools.size,
      durationMs: Math.max(0, this.#d.now() - child.startedAt),
    }
  }

  #emitTask(child: Child, lastTool?: string, summary?: string): void {
    const input = this.#calls.get(child.toolCallId)?.input ?? {}
    const parent = this.#children.get(child.owner)
    const description = str(input.description)
    this.#d.emit({
      kind: K.task,
      taskId: child.id,
      toolCallId: child.toolCallId,
      taskKind: TASK_KIND.subagent,
      name: str(input.agent) ?? TASK_FALLBACK_NAME,
      ...(description ? { description } : {}),
      status: child.status,
      ...(summary ? { summary } : {}),
      ...(lastTool ? { lastTool } : {}),
      usage: this.#usage(child),
      depth: child.depth,
      ...(parent ? { parentId: parent.toolCallId } : {}),
    })
  }
}
