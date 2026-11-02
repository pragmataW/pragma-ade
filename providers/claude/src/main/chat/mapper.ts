import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import {
  type ChatEvent,
  ERROR_CODE,
  EVENT_KIND as K,
  MAX_TOOL_OUTPUT_CHARS,
  MESSAGE_ORIGIN,
  TEXT_MODE,
  TOOL_STATUS,
  TRUNCATION_MARKER,
  TURN_END_REASON,
  USER_ROLE,
} from '@pragma/module-chat/contract'
import {
  ASSISTANT_ERROR,
  BLOCK,
  CLAUDE_CUSTOM_EVENTS,
  CLAUDE_TOOLS,
  DELTA,
  FRAME,
  IMAGE_NAME,
  JOIN_NEWLINE,
  PART_ID_SEPARATOR,
  RESULT_SUBTYPE,
  STREAM_EVENT,
  SYSTEM_SUBTYPE,
} from './constants'
import { fileEditFor, todoFor, toolKindFor, toolTitleFor } from './tool-kinds'

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : [])

/** An SDK message or a history `SessionMessage` (same `type`/`message` shape). */
export type MapperFrame = SDKMessage | { type: string; uuid?: string; message?: unknown }

export interface SdkMessageMapperOptions {
  maxOutputChars?: number
  /** `history`: user text frames become `message{origin:'history'}`; live user text is emitted by the core. */
  origin?: (typeof MESSAGE_ORIGIN)[keyof typeof MESSAGE_ORIGIN]
}

export interface SdkMessageMapper {
  map(msg: MapperFrame): ChatEvent[]
  markInterruptRequested(): void
  /** History: tools without a result count as completed. */
  finish(): ChatEvent[]
}

/** Text joined from a tool_result `content` (string or blocks), cut to `max` chars plus a marker. */
export function truncateOutput(content: unknown, max: number): { output: string; outputTruncated?: boolean } {
  const text =
    typeof content === 'string'
      ? content
      : list(content)
          .map((b) => str(b.text))
          .filter((t): t is string => t !== undefined)
          .join(JOIN_NEWLINE)
  return text.length > max
    ? { output: `${text.slice(0, max)}${TRUNCATION_MARKER}`, outputTruncated: true }
    : { output: text }
}

const contextOf = (usage: Obj): number =>
  num(usage.input_tokens) +
  num(usage.cache_read_input_tokens) +
  num(usage.cache_creation_input_tokens) +
  num(usage.output_tokens)

const DELTA_KINDS: Record<string, { block: string; field: string; kind: typeof K.textDelta | typeof K.thinking }> = {
  [DELTA.text]: { block: BLOCK.text, field: BLOCK.text, kind: K.textDelta },
  [DELTA.thinking]: { block: BLOCK.thinking, field: BLOCK.thinking, kind: K.thinking },
}

const assistantErrorCode = (e: string) => {
  if (e === ASSISTANT_ERROR.auth) return ERROR_CODE.auth
  return e === ASSISTANT_ERROR.rateLimit ? ERROR_CODE.rate_limit : ERROR_CODE.unknown
}

/** Stateful SDK → chat event mapping (part ids `<message.id>:<block index>`, RF5 truncation). */
export function createSdkMessageMapper(opts: SdkMessageMapperOptions = {}): SdkMessageMapper {
  const max = opts.maxOutputChars ?? MAX_TOOL_OUTPUT_CHARS
  const history = opts.origin === MESSAGE_ORIGIN.history
  /** Blocks seen per message id on the complete-assistant path. */
  const cursor = new Map<string, number>()
  /** Stream path: block type per part id. */
  const streamBlocks = new Map<string, string>()
  const tools = new Map<string, { name: string; input: unknown }>()
  const openTools = new Set<string>()
  let streamMessageId = ''
  let lastUsage: Obj = {}
  let interruptRequested = false
  let userMessages = 0

  const partId = (messageId: string, k: number) => `${messageId}${PART_ID_SEPARATOR}${k}`

  function streamEvent(event: Obj): ChatEvent[] {
    if (event.type === STREAM_EVENT.messageStart) {
      streamMessageId = str(obj(event.message).id) ?? ''
      return []
    }
    const id = partId(streamMessageId, num(event.index))
    if (event.type === STREAM_EVENT.blockStart) return blockStart(id, obj(event.content_block))
    return event.type === STREAM_EVENT.blockDelta ? blockDelta(id, obj(event.delta)) : []
  }

  /** A text/thinking delta for a block whose start announced the same type. */
  function blockDelta(id: string, delta: Obj): ChatEvent[] {
    const spec = DELTA_KINDS[str(delta.type) ?? '']
    if (!spec || streamBlocks.get(id) !== spec.block) return []
    const text = str(delta[spec.field]) ?? ''
    return [{ kind: spec.kind, messageId: streamMessageId, partId: id, text, mode: TEXT_MODE.delta }]
  }

  function blockStart(id: string, block: Obj): ChatEvent[] {
    const type = str(block.type) ?? ''
    streamBlocks.set(id, type)
    if (type !== BLOCK.toolUse) return []
    const name = str(block.name) ?? ''
    const toolCallId = str(block.id) ?? id
    return [{ kind: K.toolCall, toolCallId, name, toolKind: toolKindFor(name), input: {}, status: TOOL_STATUS.pending }]
  }

  function toolUse(block: Obj): ChatEvent[] {
    const name = str(block.name) ?? ''
    const toolCallId = str(block.id) ?? ''
    tools.set(toolCallId, { name, input: block.input })
    openTools.add(toolCallId)
    const call: ChatEvent = {
      kind: K.toolCall,
      toolCallId,
      name,
      toolKind: toolKindFor(name),
      title: toolTitleFor(name, block.input),
      input: block.input ?? {},
      status: TOOL_STATUS.running,
    }
    if (name === CLAUDE_TOOLS.todoWrite) return [call, { kind: K.todo, toolCallId, items: todoFor(block.input) }]
    const edit = fileEditFor(name, block.input)
    return edit ? [call, { ...edit, toolCallId }] : [call]
  }

  function assistantBlock(messageId: string, block: Obj): ChatEvent[] {
    const k = cursor.get(messageId) ?? 0
    cursor.set(messageId, k + 1)
    const id = partId(messageId, k)
    if (block.type === BLOCK.text)
      return [{ kind: K.textDelta, messageId, partId: id, text: str(block.text) ?? '', mode: TEXT_MODE.snapshot }]
    if (block.type === BLOCK.thinking)
      return [{ kind: K.thinking, messageId, partId: id, text: str(block.thinking) ?? '', mode: TEXT_MODE.snapshot }]
    return block.type === BLOCK.toolUse ? toolUse(block) : []
  }

  function assistant(frame: Obj): ChatEvent[] {
    const message = obj(frame.message)
    const messageId = str(message.id) ?? str(frame.uuid) ?? ''
    if (message.usage) lastUsage = obj(message.usage)
    const events = list(message.content).flatMap((b) => assistantBlock(messageId, b))
    const error = str(frame.error)
    if (!error) return events
    return [...events, { kind: K.error, code: assistantErrorCode(error), message: error, fatal: false }]
  }

  function toolResult(block: Obj, toolUseResult: unknown): ChatEvent[] {
    const toolCallId = str(block.tool_use_id) ?? ''
    openTools.delete(toolCallId)
    const { output, outputTruncated } = truncateOutput(block.content, max)
    const isError = block.is_error === true
    const result: ChatEvent = {
      kind: K.toolResult,
      toolCallId,
      status: isError ? TOOL_STATUS.error : TOOL_STATUS.completed,
      output,
      ...(outputTruncated ? { outputTruncated } : {}),
      ...(isError ? { error: output } : {}),
    }
    const tool = tools.get(toolCallId)
    const rewrite =
      tool?.name === CLAUDE_TOOLS.write && toolUseResult ? fileEditFor(tool.name, tool.input, toolUseResult) : undefined
    return rewrite ? [result, { ...rewrite, toolCallId }] : [result]
  }

  function userText(frame: Obj, content: unknown): ChatEvent[] {
    if (!history || frame.isSynthetic === true) return []
    const blocks = typeof content === 'string' ? [{ type: BLOCK.text, text: content }] : list(content)
    const text = blocks
      .map((b) => (b.type === BLOCK.text ? str(b.text) : undefined))
      .filter((t): t is string => t !== undefined)
      .join(JOIN_NEWLINE)
    const attachments = blocks
      .filter((b) => b.type === BLOCK.image)
      .map((b) => ({ kind: BLOCK.image, name: IMAGE_NAME, mediaType: str(obj(b.source).media_type) ?? '' }))
    if (!text && attachments.length === 0) return []
    const messageId = str(frame.uuid) ?? `${FRAME.user}${PART_ID_SEPARATOR}${++userMessages}`
    return [{ kind: K.message, messageId, role: USER_ROLE, text, attachments, origin: MESSAGE_ORIGIN.history }]
  }

  function user(frame: Obj): ChatEvent[] {
    const content = obj(frame.message).content
    const results = list(content).filter((b) => b.type === BLOCK.toolResult)
    if (results.length === 0) return userText(frame, content)
    return results.flatMap((b) => toolResult(b, frame.tool_use_result))
  }

  function turnEnd(frame: Obj): ChatEvent[] {
    const subtype = str(frame.subtype)
    const wasInterrupted = interruptRequested
    interruptRequested = false
    if (subtype === RESULT_SUBTYPE.success && frame.is_error !== true)
      return [{ kind: K.turnEnd, reason: TURN_END_REASON.completed }]
    if (subtype === RESULT_SUBTYPE.errorDuringExecution && wasInterrupted)
      return [{ kind: K.turnEnd, reason: TURN_END_REASON.interrupted }]
    if (subtype === RESULT_SUBTYPE.maxTurns || subtype === RESULT_SUBTYPE.maxBudget)
      return [{ kind: K.turnEnd, reason: TURN_END_REASON.limit }]
    const errors = Array.isArray(frame.errors) ? frame.errors.map(String) : [str(frame.result) ?? subtype ?? '']
    return [
      { kind: K.error, code: ERROR_CODE.turn_failed, message: errors.join(JOIN_NEWLINE), fatal: false },
      { kind: K.turnEnd, reason: TURN_END_REASON.error },
    ]
  }

  function result(frame: Obj): ChatEvent[] {
    const usage = obj(frame.usage)
    const windows = Object.values(obj(frame.modelUsage)).map((u) => num(obj(u).contextWindow))
    const contextWindow = Math.max(0, ...windows)
    const contextTokens = contextOf(lastUsage)
    const usageEvent: ChatEvent = {
      kind: K.usage,
      inputTokens: num(usage.input_tokens),
      outputTokens: num(usage.output_tokens),
      cacheReadTokens: num(usage.cache_read_input_tokens),
      cacheWriteTokens: num(usage.cache_creation_input_tokens),
      ...(typeof frame.total_cost_usd === 'number' ? { costUsd: frame.total_cost_usd } : {}),
      ...(contextWindow > 0 ? { contextWindow } : {}),
      ...(contextTokens > 0 ? { contextTokens } : {}),
    }
    return [usageEvent, ...turnEnd(frame)]
  }

  function system(frame: Obj): ChatEvent[] {
    if (frame.subtype === SYSTEM_SUBTYPE.init) {
      const id = str(frame.session_id)
      return [id ? { kind: K.sessionInfo, externalSessionId: id } : { kind: K.sessionInfo }]
    }
    if (frame.subtype !== SYSTEM_SUBTYPE.compactBoundary) return []
    const meta = obj(frame.compact_metadata)
    return [
      {
        kind: K.custom,
        type: CLAUDE_CUSTOM_EVENTS.compactBoundary,
        data: { trigger: str(meta.trigger), preTokens: num(meta.pre_tokens) },
      },
    ]
  }

  const HANDLERS: Record<string, (frame: Obj) => ChatEvent[]> = {
    [FRAME.streamEvent]: (f) => streamEvent(obj(f.event)),
    [FRAME.assistant]: assistant,
    [FRAME.user]: user,
    [FRAME.result]: result,
    [FRAME.system]: system,
  }

  return {
    map: (msg) => HANDLERS[str(obj(msg).type) ?? '']?.(obj(msg)) ?? [],
    markInterruptRequested() {
      interruptRequested = true
    },
    finish() {
      const done = [...openTools].map(
        (toolCallId): ChatEvent => ({ kind: K.toolResult, toolCallId, status: TOOL_STATUS.completed }),
      )
      openTools.clear()
      return done
    },
  }
}
