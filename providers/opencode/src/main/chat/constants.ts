/** Chat-capability constants (§10.1.5, phase 11b). Pure, no imports. */

/** `opencode [profile args] serve …`: always a private stdio-leased server on a random loopback port. */
export const SERVE_ARGS = ['serve', '--stdio', '--hostname', '127.0.0.1', '--port', '0'] as const
export const VERSION_FLAG = '--version'

export const BASIC_USER = 'opencode'
export const BASIC_SCHEME = 'Basic'
export const PASSWORD_ENV = 'OPENCODE_SERVER_PASSWORD'
export const ALT_PASSWORD_ENV = 'OPENCODE_PASSWORD'
/** Session-scoped env from 03's decorators: one server hosts many sessions, so these never reach `serve`. */
export const SESSION_SCOPED_ENV = ['PRAGMA_SESSION_ID'] as const
export const PASSWORD_BYTES = 32
export const PASSWORD_ENCODING = 'base64url'
export const HASH_ALGORITHM = 'sha256'
export const HASH_ENCODING = 'hex'

export const DIRECTORY_HEADER = 'x-opencode-directory'
export const AUTHORIZATION_HEADER = 'authorization'

export const IDLE_GRACE_ENV = 'PRAGMA_OPENCODE_IDLE_GRACE_MS'
export const IDLE_GRACE_MS = 2000
export const STOP_GRACE_MS = 3000
export const INFO_TIMEOUT_MS = 5000
export const VERSION_PROBE_TIMEOUT_MS = 5000
export const SSE_RECONNECT_MS = 500

export const OUTPUT_TAIL_BYTES = 4096
export const TOOL_OUTPUT_MAX_CHARS = 20_000
export const HISTORY_PAGE = 200
export const MIN_MAJOR = 2
export const LEGACY_VERSION_LABEL = '1.x'

export const INFO_PATH = '/api/info'
export const HEALTH_PATH = '/global/health'
export const HTTP_NOT_FOUND = 404
export const HTTP_STATUS = { unauthorized: 401, forbidden: 403, rateLimited: 429 } as const

/** `--stdio`: `{"url":"http://127.0.0.1:<port>"}`; default mode: `server listening on <url>`; 1.x: `opencode server listening on <url>`. */
export const STDIO_READY_RE = /^\s*\{\s*"url"\s*:\s*"(?<url>https?:\/\/[^"]+)"\s*\}\s*$/m
export const READY_RE = /^(?<legacy>opencode )?server listening on (?<url>https?:\/\/\S+)/m
export const MENTION_RE = /(^|\s)@(\S+)/g
export const HUNK_HEADER_RE = /^@@ .* @@/
export const NO_NEWLINE_MARKER = '\\'
export const LINE_PREFIX = { context: ' ', removed: '-', added: '+' } as const
export const NEWLINE = '\n'
export const SLASH = '/'
export const MODEL_REF_SEPARATOR = '/'

export const SIGNALS = { term: 'SIGTERM', kill: 'SIGKILL' } as const
export const ENOENT = 'ENOENT'
export const WIN32 = 'win32'
export const TASKKILL = 'taskkill'
export const TASKKILL_ARGS = ['/T', '/F', '/PID'] as const

/** OpenCode v2 event types this adapter consumes. */
export const EV = {
  connected: 'server.connected',
  inboxEnqueued: 'session.inbox.enqueued',
  executionStarted: 'session.execution.started',
  executionSucceeded: 'session.execution.succeeded',
  executionFailed: 'session.execution.failed',
  executionInterrupted: 'session.execution.interrupted',
  stepStarted: 'session.step.started',
  stepEnded: 'session.step.ended',
  stepFailed: 'session.step.failed',
  retryScheduled: 'session.retry.scheduled',
  usageUpdated: 'session.usage.updated',
  textDelta: 'session.text.delta',
  textEnded: 'session.text.ended',
  reasoningDelta: 'session.reasoning.delta',
  reasoningEnded: 'session.reasoning.ended',
  toolInputStarted: 'session.tool.input.started',
  toolCalled: 'session.tool.called',
  toolSuccess: 'session.tool.success',
  toolFailed: 'session.tool.failed',
  permissionAsked: 'permission.asked',
  permissionReplied: 'permission.replied',
  formCreated: 'form.created',
  formReplied: 'form.replied',
  formCancelled: 'form.cancelled',
  sessionCreated: 'session.created',
  toolProgress: 'session.tool.progress',
  mcpStatusChanged: 'mcp.status.changed',
  modelUpdated: 'model.updated',
  providerUpdated: 'provider.updated',
  integrationUpdated: 'integration.updated',
  credentialUpdated: 'credential.updated',
} as const
/** The SSE `types` filter (`server.connected` always comes). */
export const CONSUMED_EVENT_TYPES = [
  EV.inboxEnqueued,
  EV.executionStarted,
  EV.executionSucceeded,
  EV.executionFailed,
  EV.executionInterrupted,
  EV.stepStarted,
  EV.stepEnded,
  EV.stepFailed,
  EV.retryScheduled,
  EV.usageUpdated,
  EV.textDelta,
  EV.textEnded,
  EV.reasoningDelta,
  EV.reasoningEnded,
  EV.toolInputStarted,
  EV.toolCalled,
  EV.toolSuccess,
  EV.toolFailed,
  EV.permissionAsked,
  EV.permissionReplied,
  EV.formCreated,
  EV.formReplied,
  EV.formCancelled,
  EV.sessionCreated,
  EV.toolProgress,
  EV.mcpStatusChanged,
  EV.modelUpdated,
  EV.providerUpdated,
  EV.integrationUpdated,
  EV.credentialUpdated,
] as const
export const OTHER_EVENT = 'other'

export const PERMISSION_DECISIONS = ['once', 'always', 'reject'] as const
export const IDLE_OUTCOMES = ['succeeded', 'failed', 'interrupted'] as const
export const FILE_STATUSES = ['added', 'deleted', 'modified'] as const
export const OPENCODE_TODO_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export const MESSAGE_TYPES = { user: 'user', assistant: 'assistant', idle: 'idle' } as const
export const CONTENT_TYPES = { text: 'text', reasoning: 'reasoning', tool: 'tool', file: 'file' } as const
export const TOOL_STATES = { completed: 'completed', error: 'error' } as const
export const AGENT_MODES = { primary: 'primary', all: 'all' } as const
export const DEFAULT_AGENT = 'build'
export const ORDER = { asc: 'asc', desc: 'desc' } as const
export const PART_KIND = { text: 'text', reasoning: 'reasoning' } as const
export const PART_ID_SEPARATOR = ':'
export const IMAGE_MEDIA_PREFIX = 'image/'
export const INLINE_SOURCE = { type: 'inline' } as const
export const DATA_URI = (mediaType: string, base64: string) => `data:${mediaType};base64,${base64}`
export const ERROR_TYPE_HINTS = { rateLimit: 'RateLimit' } as const

export const REASON = {
  upgradeRequired: 'opencode:chat.unsupported.upgradeRequired',
  infoFailed: 'opencode:chat.unsupported.infoFailed',
  emptyCommand: 'opencode:chat.unsupported.emptyCommand',
  commandNotFound: 'chat:unsupported.commandNotFound',
  exitedEarly: 'chat:unsupported.exitedEarly',
  noProtocol: 'chat:unsupported.noProtocol',
} as const
export const OPENCODE_KEY_PREFIX = 'opencode:'
export const SERVER_EXITED_KEY = 'opencode:chat.error.serverExited'
export const AGENT_OPTION_LABEL_KEY = 'opencode:chat.option.agent'
export const AGENT_OPTION_KEY = 'agent'
export const SESSION_NOT_FOUND = 'session not found'
export const INVALID_FORM_ANSWER = 'invalid form answer'

/** Text sent to the agent (fixed English, not i18n). */
export const FORM_CANCEL_MESSAGE = {
  interrupted: 'Interrupted by the user.',
  closed: 'The chat session was closed.',
} as const
/** zod discriminator of OpenCode's tagged unions. */
export const TYPE_KEY = 'type'
export const START_FAILURE = {
  legacy: 'legacy',
  old: 'old',
  infoError: 'info-error',
  spawnError: 'spawn-error',
  exited: 'exited',
  timeout: 'timeout',
} as const
export const READY_FORMATS = ['stdio', 'listening', 'legacy'] as const
export const READY_FORMAT = { stdio: 'stdio', listening: 'listening', legacy: 'legacy' } as const
export const PIPE_STDIO = ['pipe', 'pipe', 'pipe'] as const
export const STREAM_EVENT = { data: 'data', error: 'error', close: 'close' } as const
export const PROCESS_EXIT_EVENT = 'exit'
export const POOL_DISPOSED = 'pool disposed'

/** OpenCode tool name → chat tool kind (anything else is `other`). */
export const TOOL_KINDS = {
  shell: 'shell',
  bash: 'shell',
  read: 'read',
  glob: 'search',
  grep: 'search',
  list: 'search',
  edit: 'edit',
  patch: 'edit',
  apply_patch: 'edit',
  write: 'write',
  webfetch: 'web',
  websearch: 'web',
  subagent: 'task',
  task: 'task',
  todo: 'todo',
  todowrite: 'todo',
} as const
/** Tool input fields that name the target, first present wins. */
export const TITLE_KEYS = ['path', 'filePath', 'command', 'pattern', 'url', 'query', 'description', 'name'] as const
export const SLASH_RE = /^\/(?<name>\S+)(?:\s+(?<rest>[\s\S]*))?$/
export const MENTION_SIGIL = '@'
export const DEFAULT_VARIANT_LABEL_KEY = 'opencode:chat.option.defaultVariant'
export const INVALID_OPTION = 'invalid option'

/**
 * How a prompt sent during a running turn reaches OpenCode's inbox: `steer` (default) at the next step boundary of the
 * running execution, `queue` after it. Both are accepted by 2.x and answered in the same execution (verified 2.2.5).
 */
export const BUSY_DELIVERIES = ['steer', 'queue'] as const
export const BUSY_DELIVERY = 'steer'

/** Tools that run a subagent in a child session (OpenCode 2.x `subagent`; older builds `task`). */
export const SUBAGENT_TOOLS = ['subagent', 'task'] as const
/** `<subagent sessionID=… state=…>answer</subagent>` (the subagent tool's result). */
export const SUBAGENT_RESULT_RE = /<subagent\b[^>]*>(?<body>[\s\S]*?)<\/subagent>/
/** Task name when OpenCode names no agent. */
export const TASK_FALLBACK_NAME = 'subagent'

/** Hosts of a local model server (`new URL(baseURL).hostname`). */
export const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1'] as const
export const PROVIDER_ACTIVATION = { disabled: 'disabled' } as const
/** Hints on model choices (the picker shows them under the model). */
export const MODEL_HINT_KEYS = {
  reauth: 'opencode:chat.model.reauth',
  local: 'opencode:chat.model.local',
} as const
/** Errors that mean the provider rejected the saved credential (`provider.auth`, `api_key_expired`, …). */
export const AUTH_ERROR_RE = /auth|api[_-]?key|credential|unauthori[sz]ed/i

/** Settings › OpenCode: the pooled `serve` of the default command (credentials are global to OpenCode). */
export const SETTINGS_PROFILE = 'opencode.settings'
export const SETTINGS_STARTUP_TIMEOUT_MS = 20_000
/** Tests: the `opencode` command Settings › OpenCode runs (default: `opencode` on PATH). */
export const SETTINGS_COMMAND_ENV = 'PRAGMA_OPENCODE_SETTINGS_COMMAND'
export const CONNECTION_TYPES = { credential: 'credential', env: 'env' } as const
export const INTEGRATION_METHODS = { key: 'key', oauth: 'oauth' } as const
/**
 * Providers connected by API key only in a third-party app: their subscription sign-in (e.g. Claude Pro/Max) may not
 * be used here.
 */
export const KEY_ONLY_INTEGRATIONS = ['anthropic'] as const

/** OpenCode MCP status → chat MCP status (anything else reads as failed). */
export const MCP_STATUS_OF: Record<string, 'connected' | 'pending' | 'failed' | 'needs-auth' | 'disabled'> = {
  connected: 'connected',
  pending: 'pending',
  failed: 'failed',
  needs_auth: 'needs-auth',
  disabled: 'disabled',
}

/** `ask`: OpenCode's permission rules decide (risky actions ask); `auto`: every request is approved once. */
export const PERMISSION_MODES = ['ask', 'auto'] as const
export const PERMISSION_MODE = { ask: 'ask', auto: 'auto' } as const
export const PERMISSION_MODE_KEYS = {
  ask: { label: 'opencode:chat.permission.ask', description: 'opencode:chat.permission.askHint' },
  auto: { label: 'opencode:chat.permission.auto', description: 'opencode:chat.permission.autoHint' },
} as const
