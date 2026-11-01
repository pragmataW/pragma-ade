import { CLAUDE_STATUS_HOOK_EVENTS, type ClaudeHookEvent, HOOK_COMMAND_TYPE, HOOK_TIMEOUT_SECONDS } from './constants'
import { hookCommand } from './runner'

export interface ClaudeHookSettings {
  hooks: Record<ClaudeHookEvent, { hooks: { type: typeof HOOK_COMMAND_TYPE; command: string; timeout: number }[] }[]>
}

/** The `--settings` document: only `hooks`, one command per status event (no matcher = every tool). */
export function buildClaudeHookSettings(o: { runnerPath: string; platform: NodeJS.Platform }): ClaudeHookSettings {
  const entry = (event: ClaudeHookEvent) => [
    {
      hooks: [
        {
          type: HOOK_COMMAND_TYPE,
          command: hookCommand(o.runnerPath, event, o.platform),
          timeout: HOOK_TIMEOUT_SECONDS,
        },
      ],
    },
  ]
  return {
    hooks: Object.fromEntries(CLAUDE_STATUS_HOOK_EVENTS.map((e) => [e, entry(e)])) as ClaudeHookSettings['hooks'],
  }
}
