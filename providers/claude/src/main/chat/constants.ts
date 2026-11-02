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
  workflow: 'Workflow',
  todoWrite: 'TodoWrite',
  askUserQuestion: 'AskUserQuestion',
  exitPlanMode: 'ExitPlanMode',
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
export const PLAN_REJECTED_MESSAGE = 'The user did not approve the plan. Keep planning and propose a revised plan.'
export const PLAN_REJECTED_WITH_FEEDBACK = 'The user did not approve the plan. Revise it with this feedback:\n\n'
/** Multi-select labels in one `AskUserQuestion` answer. */
export const ANSWER_SEPARATOR = ', '
/** Answers in the one-line summary of a resolved card. */
export const SUMMARY_SEPARATOR = ' · '
export const DEFAULT_PERMISSION_MODE = 'default'
/** The init model entry that stands for the CLI's default model. */
export const DEFAULT_MODEL_VALUE = 'default'
export const SYSTEM_PRESET = { type: 'preset', preset: 'claude_code' } as const
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
/** Claude's permission modes, in Shift+Tab cycle order (`bypassPermissions` is outside the cycle). */
export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions'] as const
export type ClaudePermissionMode = (typeof PERMISSION_MODES)[number]
export const PERMISSION_MODE = {
  default: 'default',
  acceptEdits: 'acceptEdits',
  plan: 'plan',
  auto: 'auto',
  dontAsk: 'dontAsk',
  bypassPermissions: 'bypassPermissions',
} as const satisfies Record<ClaudePermissionMode, ClaudePermissionMode>
export const BYPASS_PERMISSIONS = PERMISSION_MODE.bypassPermissions
/** Badge tone and safety flags per mode (`chat` contract choice fields); bypass and dontAsk stay out of the cycle. */
export const PERMISSION_MODE_STYLE = {
  default: { tone: 'neutral' },
  acceptEdits: { tone: 'info' },
  plan: { tone: 'ok' },
  auto: { tone: 'accent' },
  dontAsk: { tone: 'warn', cycle: false },
  bypassPermissions: { tone: 'err', warn: true, dangerous: true, requiresConfirm: true, cycle: false },
} as const satisfies Record<ClaudePermissionMode, Record<string, string | boolean>>
/** Modes a plan approval can continue in (the kit lists them in this order). */
export const PLAN_APPROVE_MODES = [PERMISSION_MODE.acceptEdits, PERMISSION_MODE.auto, PERMISSION_MODE.default] as const
export const SDK_SETTING_EFFORT = 'effortLevel'
export const SDK_SETTING_FAST_MODE = 'fastMode'
/** The session option key of the fast mode toggle. */
export const FAST_MODE_OPTION = 'fastMode'
export const IMAGE_NAME = 'image'

/** SDK frame type / subtype names the mapper reads. */
export const FRAME = {
  assistant: 'assistant',
  user: 'user',
  result: 'result',
  system: 'system',
  streamEvent: 'stream_event',
  rateLimit: 'rate_limit_event',
} as const
export const SYSTEM_SUBTYPE = {
  init: 'init',
  compactBoundary: 'compact_boundary',
  taskStarted: 'task_started',
  taskUpdated: 'task_updated',
  taskProgress: 'task_progress',
  taskNotification: 'task_notification',
  backgroundTasksChanged: 'background_tasks_changed',
  apiRetry: 'api_retry',
  permissionDenied: 'permission_denied',
} as const
/** SDK `task_type` values with their own card kind. */
export const TASK_TYPE = { agent: 'local_agent', workflow: 'local_workflow', bash: 'local_bash' } as const
/** Card names of jobs without a subagent type or workflow name (tool names, as the tool rows show them). */
export const TASK_TYPE_NAMES: Record<string, string> = { [TASK_TYPE.bash]: CLAUDE_TOOLS.bash }
/** `task_notification.status` → chat task status. */
export const NOTIFICATION_STATUS = { completed: 'completed', failed: 'failed', stopped: 'killed' } as const
/** `rate_limit_info.status` → chat rate-limit status. */
export const RATE_LIMIT_INFO_STATUS = { allowed: 'cleared', allowed_warning: 'warning', rejected: 'rejected' } as const
/** SDK `resetsAt` is in seconds; values above this are already milliseconds. */
export const EPOCH_SECONDS_MAX = 1e11
export const MS_PER_SECOND = 1000
export const PERCENT = 100
/** `mcp_servers[].status` values the chat contract knows; others read as pending. */
export const MCP_PENDING = 'pending'
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
  document: 'document',
} as const
export const DELTA = { text: 'text_delta', thinking: 'thinking_delta' } as const
export const RESULT_SUBTYPE = {
  success: 'success',
  errorDuringExecution: 'error_during_execution',
  maxTurns: 'error_max_turns',
  maxBudget: 'error_max_budget_usd',
} as const
export const ASSISTANT_ERROR = { auth: 'authentication_failed', rateLimit: 'rate_limit' } as const
