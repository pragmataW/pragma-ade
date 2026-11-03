import { type AskCapability, type AskOutput, profileArgValue } from '@pragma/module-cli-integration/contract'
import { type CapabilityContext, defineCapability, z } from '@pragma/sdk'
import { ASK_ARGS, MODEL_FLAG, PROVIDER_ID, STDERR_TAIL_CHARS } from '../constants'
import { withoutClaudeSessionStamps } from './inherited-env'

const NEWLINE = '\n'
const SUCCESS = 'success'

/** The single result object `claude -p --output-format json` prints (other fields pass through). */
const claudeResultSchema = z.looseObject({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
})

const tail = (s: string): string => s.trim().slice(-STDERR_TAIL_CHARS)

function lastResult(stdout: string): z.infer<typeof claudeResultSchema> | null {
  const line = stdout
    .split(NEWLINE)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1)
  if (!line) return null
  try {
    const parsed = claudeResultSchema.safeParse(JSON.parse(line))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Fixed English failure text (shown to the asking agent). */
function parseAnswer(out: AskOutput): ReturnType<AskCapability['parseAnswer']> {
  const result = lastResult(out.stdout)
  if (!result) {
    const why = out.exitCode === 0 ? 'returned an unexpected response' : `exited with code ${out.exitCode}`
    return { ok: false, message: `Claude Code ${why}: ${tail(out.stderr) || tail(out.stdout)}` }
  }
  if (!result.is_error && result.subtype === SUCCESS && result.result !== undefined)
    return { ok: true, text: result.result }
  return { ok: false, message: `Claude Code failed (${result.subtype}): ${result.result ?? tail(out.stderr)}` }
}

/**
 * `claude -p --output-format json` in plan mode with the edit tools disallowed, no saved session, the prompt on
 * stdin. Of the profile's args only `--model` is kept (interactive flags such as `--dangerously-skip-permissions`
 * must never reach a read-only consult).
 */
export function createAskCapability(capCtx: CapabilityContext): AskCapability {
  return {
    async buildAsk({ profile, prompt }) {
      const command = await capCtx.resolveCommand(profile.command)
      if (!command) throw new Error(`Claude Code command '${profile.command}' was not found.`)
      const env = withoutClaudeSessionStamps({ ...(await capCtx.getShellEnv()), ...profile.env })
      const model = profileArgValue(profile.args, [MODEL_FLAG])
      return { command, args: [...ASK_ARGS, ...(model ? [MODEL_FLAG, model] : [])], env, stdin: prompt }
    },
    parseAnswer,
  }
}

export default defineCapability(PROVIDER_ID, 'ask', createAskCapability)
