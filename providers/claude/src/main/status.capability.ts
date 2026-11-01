import { chmod } from 'node:fs/promises'
import type { StatusCapability } from '@pragma/module-agent-status/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { CLAUDE_HOOK_RESOURCE, CLAUDE_SETTINGS_FILE, CLAUDE_SETTINGS_FLAG, RUNNER_MODE } from './status/constants'
import { parseClaudeHookEvent } from './status/parse-event'
import { runnerSource } from './status/runner'
import { buildClaudeHookSettings } from './status/settings-file'

export interface ClaudeStatusDeps {
  hookScriptPath: string
  execPath: string
  platform: NodeJS.Platform
  chmod(path: string, mode: number): Promise<void>
}

/**
 * Per-session hooks without touching `~/.claude`: a runner script and a settings file in the session temp dir, passed
 * with `--settings <file>` before the user's args (a user `--settings` still applies after ours).
 */
export function createClaudeStatusCapability(deps: ClaudeStatusDeps): StatusCapability {
  return {
    async decorateLaunch(spec, ctx) {
      const runner = runnerSource({ execPath: deps.execPath, scriptPath: deps.hookScriptPath, platform: deps.platform })
      const runnerPath = await ctx.writeTempFile(runner.fileName, runner.contents)
      await deps.chmod(runnerPath, RUNNER_MODE)
      const settings = buildClaudeHookSettings({ runnerPath, platform: deps.platform })
      const settingsPath = await ctx.writeTempFile(CLAUDE_SETTINGS_FILE, JSON.stringify(settings))
      return { ...spec, args: [CLAUDE_SETTINGS_FLAG, settingsPath, ...spec.args] }
    },
    parseEvent: parseClaudeHookEvent,
  }
}

export default defineCapability(PROVIDER_ID, 'status', (capCtx) =>
  createClaudeStatusCapability({
    hookScriptPath: capCtx.paths.resource(CLAUDE_HOOK_RESOURCE),
    execPath: process.execPath,
    platform: process.platform,
    chmod,
  }),
)
