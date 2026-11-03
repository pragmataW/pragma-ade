import {
  ATTACHMENT_KINDS,
  type ChatEvent,
  EVENT_KIND as K,
  MESSAGE_ORIGIN,
  TEXT_MODE,
  TOOL_STATUS,
  TURN_END_REASON,
  USER_ROLE,
} from '@pragma/module-chat/contract'
import { CONTENT_TYPES, IMAGE_MEDIA_PREFIX, MESSAGE_TYPES, PART_KIND, TOOL_STATES } from '../constants'
import type { AssistantContent, IdleOutcome, Message, ModelRef, Tokens } from '../schemas'
import { errorCodeOf, partIdOf, settleTool, usageEvent } from './event-mapper'
import { agentSwitchEvents, injectedTextEvents, modelSwitchEvents } from './notices'
import { toolKindOf, toolTitleOf } from './tool-kind'

type Assistant = Extract<Message, { type: typeof MESSAGE_TYPES.assistant }>
type ContextWindow = (ref: ModelRef) => number | undefined

const OUTCOMES = {
  succeeded: TURN_END_REASON.completed,
  failed: TURN_END_REASON.error,
  interrupted: TURN_END_REASON.interrupted,
} as const satisfies Record<IdleOutcome, string>

const RESULT_STATUS = {
  [TOOL_STATES.completed]: TOOL_STATUS.completed,
  [TOOL_STATES.error]: TOOL_STATUS.error,
} as const
const isSettled = (s: string): s is keyof typeof RESULT_STATUS => Object.hasOwn(RESULT_STATUS, s)

function contentEvents(messageId: string, c: AssistantContent, i: number): ChatEvent[] {
  switch (c.type) {
    case CONTENT_TYPES.text:
    case CONTENT_TYPES.reasoning: {
      const reasoning = c.type === CONTENT_TYPES.reasoning
      const partId = partIdOf(messageId, reasoning ? PART_KIND.reasoning : PART_KIND.text, i)
      return [{ kind: reasoning ? K.thinking : K.textDelta, messageId, partId, text: c.text, mode: TEXT_MODE.snapshot }]
    }
    case CONTENT_TYPES.tool: {
      const input = c.state.input ?? {}
      const title = toolTitleOf(c.name, input)
      const call: ChatEvent = {
        kind: K.toolCall,
        toolCallId: c.id,
        name: c.name,
        toolKind: toolKindOf(c.name),
        ...(title ? { title } : {}),
        input,
        status: TOOL_STATUS.running,
      }
      const status = c.state.status
      return isSettled(status)
        ? [call, ...settleTool({ toolCallId: c.id, ...c.state, status: RESULT_STATUS[status] })]
        : [call]
    }
    default: {
      const never: never = c
      return never
    }
  }
}

const zero = (): Tokens => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })
const add = (a: Tokens, b: Tokens): Tokens => ({
  input: a.input + b.input,
  output: a.output + b.output,
  reasoning: a.reasoning + b.reasoning,
  cache: { read: a.cache.read + b.cache.read, write: a.cache.write + b.cache.write },
})

/** Replays stored v2 messages (asc) as chat events; usage is cumulative over the assistant messages. */
export function historyToEvents(messages: Message[], contextWindow: ContextWindow): ChatEvent[] {
  let totals = { tokens: zero(), cost: 0 }
  const assistant = (m: Assistant): ChatEvent[] => {
    const out = m.content.flatMap((c, i) => contentEvents(m.id, c, i))
    if (m.tokens) {
      totals = { tokens: add(totals.tokens, m.tokens), cost: totals.cost + (m.cost ?? 0) }
      out.push(usageEvent(totals, { tokens: m.tokens, model: m.model }, contextWindow))
    }
    if (m.error) out.push({ kind: K.error, code: errorCodeOf(m.error), message: m.error.message, fatal: false })
    return out
  }
  return messages.flatMap((m): ChatEvent[] => {
    switch (m.type) {
      case MESSAGE_TYPES.user:
        return [
          {
            kind: K.message,
            role: USER_ROLE,
            messageId: m.id,
            text: m.text,
            attachments: (m.files ?? [])
              .filter((f) => f.mime.startsWith(IMAGE_MEDIA_PREFIX))
              .map((f) => ({ kind: ATTACHMENT_KINDS[0], name: f.name ?? f.mime, mediaType: f.mime })),
            origin: MESSAGE_ORIGIN.history,
          },
        ]
      case MESSAGE_TYPES.assistant:
        return assistant(m)
      case MESSAGE_TYPES.idle:
        return [{ kind: K.turnEnd, reason: OUTCOMES[m.outcome] }]
      case MESSAGE_TYPES.agentSwitched:
        return agentSwitchEvents(m.agent)
      case MESSAGE_TYPES.modelSwitched:
        return modelSwitchEvents(m.model, m.previous)
      case MESSAGE_TYPES.synthetic:
      case MESSAGE_TYPES.system:
        return injectedTextEvents(m.description)
      default: {
        const never: never = m
        return never
      }
    }
  })
}
