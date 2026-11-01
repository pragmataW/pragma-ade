import { INLINE_PROMPT_MAX_CHARS, LONG_PROMPT_FILE, SEMVER_RE } from './constants'

const SPACE = ' '
const FLAG_PREFIX = '-'
const WHITESPACE_RE = /\s/

/** What `resolvePromptText` needs from a `LaunchContext`. */
export interface PromptFileWriter {
  /** Writes a 0600 file into the session's temp dir and resolves with its absolute path. */
  writeTempFile(name: string, contents: string): Promise<string>
}

/**
 * Prefixes one space when `p` starts with `-` (so it is not parsed as a flag) or, with `singleWord`, when it has no
 * whitespace (so a CLI does not dispatch it as a subcommand, e.g. `claude update`).
 */
export function padFlagLike(p: string, opts: { singleWord?: boolean } = {}): string {
  const pad = p.startsWith(FLAG_PREFIX) || (opts.singleWord === true && !WHITESPACE_RE.test(p))
  return pad ? `${SPACE}${p}` : p
}

/** Fixed English text sent to the agent (not i18n, §6). */
export const longPromptInstruction = (path: string): string =>
  `Your task is in the file ${path}. Read the whole file and follow its instructions.`

/** Long prompts go to `LONG_PROMPT_FILE` in the session temp dir; the agent gets `longPromptInstruction`. */
export async function resolvePromptText(
  ctx: PromptFileWriter,
  prompt: string,
): Promise<{ text: string; tempFiles: string[] }> {
  if (prompt.length <= INLINE_PROMPT_MAX_CHARS) return { text: prompt, tempFiles: [] }
  const path = await ctx.writeTempFile(LONG_PROMPT_FILE, prompt)
  return { text: longPromptInstruction(path), tempFiles: [path] }
}

/** The first `major.minor.patch` in `text`, or null. */
export function parseSemver(text: string): [number, number, number] | null {
  const m = SEMVER_RE.exec(text)
  if (!m) return null
  const [, major, minor, patch] = m
  return [Number(major), Number(minor), Number(patch)]
}
