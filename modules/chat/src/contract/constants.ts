/** Constants shared with providers and other modules (§9, §10.1.5); module-internal ones live in `../constants.ts`. */
import { keyedEnum, TERMINAL_MODE } from '@pragma/module-agents/contract'

export const CHAT_MODULE_ID = 'chat'
/** The agent-session mode this module registers (§4.5, §10.3). */
export const CHAT_MODE = 'chat'
export const CHAT_MODES = [TERMINAL_MODE, CHAT_MODE] as const
export type ChatModeName = (typeof CHAT_MODES)[number]

/** Option keys shared by the kit, the Claude adapter and 11b. */
export const CHAT_OPTION_KEYS = { model: 'model', effort: 'effort', permissionMode: 'permissionMode' } as const

export const CHAT_TOOL_KINDS = ['shell', 'read', 'search', 'edit', 'write', 'web', 'task', 'todo', 'other'] as const
export const TOOL_KIND = keyedEnum(CHAT_TOOL_KINDS)

export const CHAT_EVENT_KINDS = [
  'session-info',
  'options',
  'message',
  'turn-start',
  'text-delta',
  'thinking',
  'tool-call',
  'tool-result',
  'file-edit',
  'todo',
  'permission-request',
  'permission-resolved',
  'usage',
  'error',
  'turn-end',
  'session-exit',
  'queue',
  'custom',
  'response-resolved',
] as const
export const EVENT_KIND = {
  sessionInfo: 'session-info',
  options: 'options',
  message: 'message',
  turnStart: 'turn-start',
  textDelta: 'text-delta',
  thinking: 'thinking',
  toolCall: 'tool-call',
  toolResult: 'tool-result',
  fileEdit: 'file-edit',
  todo: 'todo',
  permissionRequest: 'permission-request',
  permissionResolved: 'permission-resolved',
  usage: 'usage',
  error: 'error',
  turnEnd: 'turn-end',
  sessionExit: 'session-exit',
  queue: 'queue',
  custom: 'custom',
  responseResolved: 'response-resolved',
} as const satisfies Record<string, (typeof CHAT_EVENT_KINDS)[number]>

export const CHAT_PERMISSION_OPTIONS = ['allow_once', 'allow_always', 'deny'] as const
export const PERMISSION_OPTION = keyedEnum(CHAT_PERMISSION_OPTIONS)
export const CHAT_PERMISSION_OUTCOMES = ['allowed', 'allowed_always', 'denied', 'cancelled'] as const
export const PERMISSION_OUTCOME = keyedEnum(CHAT_PERMISSION_OUTCOMES)
export const CHAT_ERROR_CODES = [
  'startup_unsupported',
  'process_exited',
  'turn_failed',
  'auth',
  'rate_limit',
  'unknown',
] as const
export const ERROR_CODE = keyedEnum(CHAT_ERROR_CODES)
export const TEXT_MODES = ['delta', 'snapshot'] as const
export const TEXT_MODE = keyedEnum(TEXT_MODES)
export const MESSAGE_ORIGINS = ['live', 'history'] as const
export const MESSAGE_ORIGIN = keyedEnum(MESSAGE_ORIGINS)
export const USER_ROLE = 'user'
export const TOOL_CALL_STATUSES = ['pending', 'running'] as const
export const TOOL_RESULT_STATUSES = ['completed', 'error'] as const
export const TOOL_STATUSES = [...TOOL_CALL_STATUSES, ...TOOL_RESULT_STATUSES] as const
export const TOOL_STATUS = keyedEnum(TOOL_STATUSES)
export const FILE_CHANGES = ['edit', 'create', 'overwrite', 'delete'] as const
export const FILE_CHANGE = keyedEnum(FILE_CHANGES)
export const TODO_STATUSES = ['pending', 'active', 'done'] as const
export const TODO_STATUS = keyedEnum(TODO_STATUSES)
export const TURN_END_REASONS = ['completed', 'interrupted', 'error', 'limit'] as const
export const TURN_END_REASON = keyedEnum(TURN_END_REASONS)
export const SESSION_EXIT_REASONS = ['closed', 'crashed', 'startup_failed'] as const
export const SESSION_EXIT_REASON = keyedEnum(SESSION_EXIT_REASONS)
export const RESPONSE_OUTCOMES = ['answered', 'cancelled'] as const
export const RESPONSE_OUTCOME = keyedEnum(RESPONSE_OUTCOMES)
export const OPTION_TYPES = ['enum', 'boolean', 'number'] as const
export const OPTION_TYPE = keyedEnum(OPTION_TYPES)
export const ATTACHMENT_KINDS = ['image'] as const

/** Limits applied by adapters and the kit (RF5). */
export const MAX_TOOL_OUTPUT_CHARS = 32_768
export const MAX_DIFF_CHARS = 400_000
/** 5 MB */
export const MAX_IMAGE_BYTES = 5_242_880
export const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
export const TRUNCATION_MARKER = '\n… [output truncated]'
/** `<provider-id>.<name>` */
export const CUSTOM_EVENT_TYPE_RE = /^[a-z0-9-]+\.[a-z0-9_.-]+$/
export const CUSTOM_PART_PREFIX = 'custom:'
/** agent-status `turnFailed.message` limit. */
export const STATUS_MESSAGE_MAX = 500

export const MIN_STARTUP_TIMEOUT_MS = 1000
export const DEFAULT_STARTUP_TIMEOUT_MS = 20_000
export const FILE_SEARCH_LIMIT = 50

export const CHAT_SERVICE_ID = 'chat.service'
export const CHAT_IPC = {
  open: 'chat.open',
  send: 'chat.send',
  cancelQueued: 'chat.cancelQueued',
  interrupt: 'chat.interrupt',
  respondPermission: 'chat.respondPermission',
  respond: 'chat.respond',
  setOption: 'chat.setOption',
  searchFiles: 'chat.searchFiles',
  checkSupport: 'chat.checkSupport',
  testSnapshot: 'chat.test.snapshot',
} as const
export const CHAT_IPC_EVENTS = { event: 'chat.event', composerAppend: 'chat.composerAppend' } as const

/** Reason keys (`chat:unsupported.*`) shared with adapters. */
export const UNSUPPORTED_REASON = {
  noProtocol: 'chat:unsupported.noProtocol',
  exitedEarly: 'chat:unsupported.exitedEarly',
  commandNotFound: 'chat:unsupported.commandNotFound',
  noCapability: 'chat:unsupported.noCapability',
  profileDisabled: 'chat:unsupported.profileDisabled',
} as const
export const UNSUPPORTED_PREFIX = 'chat:unsupported.'
export const RESPOND_UNSUPPORTED_KEY = 'chat:errors.respondUnsupported'
