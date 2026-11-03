import type { AgentProfile } from '@pragma/module-agents/contract'
import { z } from '@pragma/sdk'

/** What a provider gets to build one headless, read-only question. */
export interface AskQuery {
  profile: Pick<AgentProfile, 'id' | 'command' | 'args' | 'env'>
  /** The worktree the consulted agent runs in. */
  cwd: string
  /** The full prompt, preamble included (fixed English). */
  prompt: string
  /** Writes a 0600 file into the question's temp dir and resolves with its absolute path. */
  writeTempFile(name: string, contents: string): Promise<string>
}

/** The process cli-integration runs for one question (it owns spawn, timeout, kill and output caps). */
export const askSpecSchema = z.object({
  /** The resolved binary. */
  command: z.string().min(1),
  args: z.array(z.string()),
  /** The full child env (shell env + profile env, cleaned by the provider). */
  env: z.record(z.string(), z.string()),
  /** Written to the child's stdin (which is always closed afterwards). */
  stdin: z.string().nullable(),
})
export type AskSpec = z.infer<typeof askSpecSchema>

/** What the process left behind. */
export interface AskOutput {
  exitCode: number | null
  stdout: string
  stderr: string
}

/** The answer, or why there is none (fixed English, shown to the asking agent). */
export type AskAnswer = { ok: true; text: string } | { ok: false; message: string }

/** Provider capability `ask`: one headless, read-only, one-shot question in `cwd`. */
export interface AskCapability {
  /** Throws an `Error` with a fixed English message (e.g. the command is not installed). */
  buildAsk(q: AskQuery): Promise<AskSpec>
  parseAnswer(out: AskOutput): AskAnswer
}

declare module '@pragma/sdk' {
  interface CapabilityMap {
    ask: AskCapability
  }
}

const INLINE_VALUE = '='

/** Value of the first `--flag v` / `--flag=v` among `names` in profile args (`undefined` when absent or empty). */
export function profileArgValue(args: readonly string[], names: readonly string[]): string | undefined {
  for (const [i, arg] of args.entries()) {
    if (names.includes(arg)) return args[i + 1] || undefined
    const name = names.find((n) => arg.startsWith(`${n}${INLINE_VALUE}`))
    if (name) return arg.slice(name.length + INLINE_VALUE.length) || undefined
  }
  return undefined
}
