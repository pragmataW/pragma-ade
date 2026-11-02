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

/**
 * Interrupt detection (no Claude hook fires when the user interrupts a turn; see `interrupt-monitor.ts`). Claude
 * writes a user entry whose text starts with `[Request interrupted by user` (`]` or ` for tool use]`) into the
 * session transcript (JSONL); verified against Claude Code 2.1.316.
 */
export const CLAUDE_TRANSCRIPT = {
  interruptPrefix: '[Request interrupted by user',
  /** Cheap pre-filter: only lines containing this are parsed as possible assistant entries. */
  assistantNeedle: '"assistant"',
  extension: '.jsonl',
  /** Transcript checks while a turn runs. */
  pollMs: 1000,
  /** After Esc/Ctrl-C: the terminal must have been quiet this long (Claude's spinner animates while it works). */
  settleMs: 2000,
  /** At most this many new bytes are read per check (the newest; markers are the last lines of a turn). */
  maxScanBytes: 1_048_576,
} as const
export const TRANSCRIPT_ENTRY = { user: 'user', assistant: 'assistant' } as const
export const CONTENT_BLOCK = { text: 'text', toolUse: 'tool_use' } as const
export const NEWLINE_BYTE = 0x0a
export const NEWLINE = '\n'
