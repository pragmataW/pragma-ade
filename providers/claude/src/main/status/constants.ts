/** Status-capability constants (§10.1.5: capability-specific, owned by phase 04). */
export const CLAUDE_STATUS_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd',
] as const
export type ClaudeHookEvent = (typeof CLAUDE_STATUS_HOOK_EVENTS)[number]
export const CLAUDE_HOOK = Object.fromEntries(CLAUDE_STATUS_HOOK_EVENTS.map((e) => [e, e])) as {
  readonly [K in ClaudeHookEvent]: K
}
export const CLAUDE_NOTIFICATION = {
  permissionPrompt: 'permission_prompt',
  elicitationDialog: 'elicitation_dialog',
} as const
export const CLAUDE_TOOL = { askUserQuestion: 'AskUserQuestion', exitPlanMode: 'ExitPlanMode' } as const
export const CLAUDE_SETTINGS_FLAG = '--settings'
export const CLAUDE_SETTINGS_FILE = 'claude-settings.json'
export const CLAUDE_HOOK_RESOURCE = 'hooks/pragma-hook.mjs'
export const HOOK_TIMEOUT_SECONDS = 5
export const HOOK_COMMAND_TYPE = 'command'
export const RUNNER_MODE = 0o700
export const RUNNER_FILE = { posix: 'pragma-hook.sh', win32: 'pragma-hook.cmd' } as const
export const WIN32 = 'win32'
export const RUN_AS_NODE_ENV = 'ELECTRON_RUN_AS_NODE'
