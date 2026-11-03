import { INLINE_PROMPT_MAX_CHARS, padFlagLike } from '@pragma/module-agents/contract'
import {
  type AskAnswer,
  type AskCapability,
  type AskOutput,
  type AskQuery,
  profileArgValue,
} from '@pragma/module-cli-integration/contract'
import { type CapabilityContext, defineCapability, z } from '@pragma/sdk'
import {
  ASK_FILE_FLAG,
  ASK_FILE_MESSAGE,
  ASK_MODEL_FLAG,
  ASK_MODEL_FLAGS,
  ASK_PROMPT_FILE,
  ASK_RUN_ARGS,
  PROVIDER_ID,
  STDERR_TAIL_CHARS,
} from '../constants'

const NEWLINE = '\n'
const PARAGRAPH = '\n\n'
const EVENT = { stepStart: 'step_start', text: 'text', error: 'error' } as const

/**
 * One line of `opencode run --format json`: `{ type, timestamp, sessionID, part?, error? }`. The v2 shape is not
 * documented, so everything but the fields read here passes through.
 */
const runEventSchema = z.looseObject({
  type: z.string(),
  part: z.looseObject({ type: z.string().optional(), text: z.string().optional() }).optional(),
  error: z.unknown().optional(),
})
type RunEvent = z.infer<typeof runEventSchema>
const errorSchema = z.looseObject({
  message: z.string().optional(),
  data: z.looseObject({ message: z.string().optional() }).optional(),
})

function parseLine(line: string): RunEvent | null {
  try {
    const parsed = runEventSchema.safeParse(JSON.parse(line))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function errorText(error: unknown): string {
  const e = errorSchema.safeParse(error)
  return (e.success && (e.data.data?.message ?? e.data.message)) || JSON.stringify(error)
}

const tail = (s: string): string => s.trim().slice(-STDERR_TAIL_CHARS)

/** The text parts of the last step that has text; the first `error` event wins. */
function parseAnswer(out: AskOutput): AskAnswer {
  let step: string[] = []
  let answer: string[] = []
  for (const line of out.stdout.split(NEWLINE)) {
    const event = parseLine(line.trim())
    if (event?.type === EVENT.error) return { ok: false, message: `OpenCode failed: ${errorText(event.error)}` }
    if (event?.type === EVENT.stepStart) step = []
    const text = event?.type === EVENT.text ? event.part?.text?.trim() : undefined
    if (text) {
      step.push(text)
      answer = step
    }
  }
  if (answer.length > 0) return { ok: true, text: answer.join(PARAGRAPH) }
  return { ok: false, message: `OpenCode returned no answer (exit ${out.exitCode}): ${tail(out.stderr)}` }
}

/** Short questions are the positional message; longer ones are attached as `question.md`. */
async function messageArgs(q: AskQuery): Promise<string[]> {
  if (q.prompt.length <= INLINE_PROMPT_MAX_CHARS) return [padFlagLike(q.prompt)]
  return [ASK_FILE_FLAG, await q.writeTempFile(ASK_PROMPT_FILE, q.prompt), ASK_FILE_MESSAGE]
}

/**
 * `opencode run --standalone --format json --agent plan [-m <model>] <message>`. Of the profile's args only the
 * model is kept (`--auto` and other interactive flags must never reach a read-only consult).
 */
export function createAskCapability(capCtx: CapabilityContext): AskCapability {
  return {
    async buildAsk(q) {
      const command = await capCtx.resolveCommand(q.profile.command)
      if (!command) throw new Error(`OpenCode command '${q.profile.command}' was not found.`)
      const model = profileArgValue(q.profile.args, ASK_MODEL_FLAGS)
      const args = [...ASK_RUN_ARGS, ...(model ? [ASK_MODEL_FLAG, model] : []), ...(await messageArgs(q))]
      return { command, args, env: { ...(await capCtx.getShellEnv()), ...q.profile.env }, stdin: null }
    },
    parseAnswer,
  }
}

export default defineCapability(PROVIDER_ID, 'ask', createAskCapability)
