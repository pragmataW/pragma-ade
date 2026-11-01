import {
  baseLaunchSpec,
  type CompatibilityResult,
  initialPromptOf,
  type LaunchCapability,
  padFlagLike,
  parseSemver,
  resolvePromptText,
} from '@pragma/module-agents/contract'
import { type CapabilityContext, defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'

const SEED_ORDER = 20
const STANDALONE_FLAG = '--standalone'
const SERVER_FLAG = '--server'
const PROMPT_FLAG = '--prompt'
const VERSION_FLAG = '--version'
const MIN_MAJOR = 2
const REQUIRED_LABEL = '2.x'
const VERSION_SEPARATOR = '.'

/** The profile already chose a server mode (`--standalone`, `--server <url>`, `--server=<url>`). */
const hasServerChoice = (args: readonly string[]): boolean =>
  args.some((a) => a === STANDALONE_FLAG || a === SERVER_FLAG || a.startsWith(`${SERVER_FLAG}=`))

/**
 * OpenCode 2.x: `opencode [flags] [<directory>]`. Terminal launches run `--standalone` (a private server, so killing
 * the pty stops a running turn) unless the profile chose a server or 11c resumes into one (`resume.serverUrl`; its
 * decorator appends `--server <url> --session <id>`). The prompt always uses the two-argv form `--prompt <v>` (the CLI
 * lexer truncates `--k=v` at a second `=`); a value starting with `-` gets one leading space. No positional directory
 * is passed: cwd is the worktree.
 */
export function createLaunchCapability(capCtx: CapabilityContext): LaunchCapability {
  return {
    seed: { order: SEED_ORDER },
    async buildLaunch(ctx) {
      const spec = baseLaunchSpec(ctx)
      const keepArgs = hasServerChoice(spec.args) || ctx.resume?.serverUrl !== undefined
      const args = keepArgs ? spec.args : [STANDALONE_FLAG, ...spec.args]
      const prompt = initialPromptOf(ctx)
      if (prompt === undefined) return { ...spec, args }
      const { text, tempFiles } = await resolvePromptText(ctx, prompt)
      return { ...spec, args: [...args, PROMPT_FLAG, padFlagLike(text)], tempFiles }
    },
    async checkCompatibility(c): Promise<CompatibilityResult> {
      const r = await c.exec([VERSION_FLAG])
      const version = parseSemver(`${r.stdout}\n${r.stderr}`)
      if (!version) {
        capCtx.log.warn(`no version from ${c.resolvedCommand} ${VERSION_FLAG} (exit ${r.exitCode})`)
        return { ok: true }
      }
      const found = version.join(VERSION_SEPARATOR)
      if (version[0] < MIN_MAJOR)
        return { ok: false, reasonKey: 'opencode:launch.minVersion', params: { required: REQUIRED_LABEL, found } }
      return { ok: true, version: found }
    },
  }
}

export default defineCapability(PROVIDER_ID, 'launch', createLaunchCapability)
