/** Chat-capability constants (§10.1.5). Pure, no imports: the renderer imports `CLAUDE_CUSTOM_EVENTS` from here. */

export const CLAUDE_TOOLS = {
  bash: 'Bash',
  bashOutput: 'BashOutput',
  killShell: 'KillShell',
  read: 'Read',
  notebookRead: 'NotebookRead',
  grep: 'Grep',
  glob: 'Glob',
  ls: 'LS',
  edit: 'Edit',
  multiEdit: 'MultiEdit',
  notebookEdit: 'NotebookEdit',
  write: 'Write',
  webFetch: 'WebFetch',
  webSearch: 'WebSearch',
  task: 'Task',
  agent: 'Agent',
  todoWrite: 'TodoWrite',
} as const

/** Provider-specific chat events (`custom:<type>` parts). */
export const CLAUDE_CUSTOM_EVENTS = { compactBoundary: 'claude.compact-boundary' } as const

export const STDERR_TAIL_BYTES = 8192
export const KILL_GRACE_MS = 3000
/** Env stamps of a parent Claude Code session; a nested CLI must not inherit them. */
export const STRIPPED_ENV = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_BRIDGE_SESSION_ID',
] as const
/** Profile args that already decide the permission mode. */
export const PERMISSION_FLAGS = [
  '--dangerously-skip-permissions',
  '--allow-dangerously-skip-permissions',
  '--permission-mode',
] as const
export const FLAG_VALUE_SEPARATOR = '='
/** The SDK runs script executables through a runtime, keeping the script at argv[0]. */
export const SCRIPT_EXECUTABLE_RE = /\.(c|m)?js$|\.ts$/
export const SIGTERM = 'SIGTERM'
export const SIGKILL = 'SIGKILL'
export const ENOENT = 'ENOENT'
/** stderr of `--resume <id>` when the CLI has no transcript for the id (claude 2.1.316). */
export const NO_CONVERSATION_RE = /No conversation found with session ID/i
export const PART_ID_SEPARATOR = ':'
export const JOIN_NEWLINE = '\n'
export const BEHAVIOR = { allow: 'allow', deny: 'deny' } as const
export const ABORT_EVENT = 'abort'
export const DENY_MESSAGE = 'User denied this action'
export const PERMISSION_CANCELLED_MESSAGE = 'Cancelled by the user'
export const DEFAULT_PERMISSION_MODE = 'default'
/** The init model entry that stands for the CLI's default model. */
export const DEFAULT_MODEL_VALUE = 'default'
export const SYSTEM_PRESET = { type: 'preset', preset: 'claude_code' } as const
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'] as const
export const BYPASS_PERMISSIONS = 'bypassPermissions'
export const SDK_SETTING_EFFORT = 'effortLevel'
export const IMAGE_NAME = 'image'

/** SDK frame type / subtype names the mapper reads. */
export const FRAME = {
  assistant: 'assistant',
  user: 'user',
  result: 'result',
  system: 'system',
  streamEvent: 'stream_event',
} as const
export const SYSTEM_SUBTYPE = { init: 'init', compactBoundary: 'compact_boundary' } as const
export const STREAM_EVENT = {
  messageStart: 'message_start',
  blockStart: 'content_block_start',
  blockDelta: 'content_block_delta',
} as const
export const BLOCK = {
  text: 'text',
  thinking: 'thinking',
  toolUse: 'tool_use',
  toolResult: 'tool_result',
  image: 'image',
} as const
export const DELTA = { text: 'text_delta', thinking: 'thinking_delta' } as const
export const RESULT_SUBTYPE = {
  success: 'success',
  errorDuringExecution: 'error_during_execution',
  maxTurns: 'error_max_turns',
  maxBudget: 'error_max_budget_usd',
} as const
export const ASSISTANT_ERROR = { auth: 'authentication_failed', rateLimit: 'rate_limit' } as const
