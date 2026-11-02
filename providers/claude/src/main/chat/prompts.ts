import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import {
  type ChatEvent,
  type ChatPlanResponse,
  type ChatQuestion,
  type ChatQuestionResponse,
  chatPlanResponseSchema,
  chatQuestionResponseSchema,
  EVENT_KIND as K,
} from '@pragma/module-chat/contract'
import {
  ANSWER_SEPARATOR,
  BEHAVIOR,
  CLAUDE_TOOLS,
  type ClaudePermissionMode,
  PERMISSION_MODE,
  PLAN_REJECTED_MESSAGE,
  PLAN_REJECTED_WITH_FEEDBACK,
  SUMMARY_SEPARATOR,
} from './constants'
import { list, obj, str } from './frame-fields'

type Input = Record<string, unknown>

/** `AskUserQuestion` / `ExitPlanMode` are answered through a card (`respond`), not a permission prompt. */
export const PROMPT_TOOLS = new Set<string>([CLAUDE_TOOLS.askUserQuestion, CLAUDE_TOOLS.exitPlanMode])

/** `AskUserQuestion` input → chat questions (the SDK adds "Other" itself; the card offers it too). */
export function questionsOf(input: Input): ChatQuestion[] {
  return list(input.questions).map((q) => ({
    question: str(q.question) ?? '',
    ...(str(q.header) ? { header: str(q.header) } : {}),
    multiSelect: q.multiSelect === true,
    options: list(q.options).map((o) => ({
      label: str(o.label) ?? '',
      ...(str(o.description) ? { description: str(o.description) } : {}),
    })),
  }))
}

/** One answer string per question (multi-select labels comma-joined, "Other" text appended). */
const answerText = (a: ChatQuestionResponse['answers'][number]): string =>
  [...a.selected, ...(a.other?.trim() ? [a.other.trim()] : [])].join(ANSWER_SEPARATOR)

export interface PromptOutcome {
  result: PermissionResult
  summary?: string
  /** The permission mode the session continues in (plan approval). */
  mode?: ClaudePermissionMode
}

/** A `respond` payload for a question: allow with `answers` keyed by question text (the SDK contract). */
export function answerQuestion(input: Input, payload: unknown): PromptOutcome {
  const { answers } = chatQuestionResponseSchema.parse(payload)
  const byQuestion = Object.fromEntries(answers.map((a) => [a.question, answerText(a)]))
  return {
    result: { behavior: BEHAVIOR.allow, updatedInput: { ...input, answers: byQuestion } },
    summary: Object.values(byQuestion).join(SUMMARY_SEPARATOR),
  }
}

const MODES = new Set<string>(Object.values(PERMISSION_MODE))
const modeOf = (r: ChatPlanResponse): ClaudePermissionMode =>
  r.mode && MODES.has(r.mode) ? (r.mode as ClaudePermissionMode) : PERMISSION_MODE.default

/** A `respond` payload for a plan: approve → allow + leave plan mode; reject → deny with the user's feedback. */
export function answerPlan(input: Input, payload: unknown): PromptOutcome {
  const r = chatPlanResponseSchema.parse(payload)
  const feedback = r.feedback?.trim()
  if (!r.approve) {
    const message = feedback ? `${PLAN_REJECTED_WITH_FEEDBACK}${feedback}` : PLAN_REJECTED_MESSAGE
    return { result: { behavior: BEHAVIOR.deny, message }, ...(feedback ? { summary: feedback } : {}) }
  }
  const mode = modeOf(r)
  return {
    result: {
      behavior: BEHAVIOR.allow,
      updatedInput: input,
      updatedPermissions: [{ type: 'setMode', mode, destination: 'session' }],
    },
    mode,
  }
}

/** The card event for a prompt tool call. */
export function promptEvent(toolName: string, eventId: string, input: Input, modes: string[]): ChatEvent {
  if (toolName === CLAUDE_TOOLS.askUserQuestion) return { kind: K.question, eventId, questions: questionsOf(input) }
  return { kind: K.planProposal, eventId, plan: str(obj(input).plan) ?? '', modes }
}
