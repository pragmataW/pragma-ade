export const CLAUDE_PROVIDER_ID = 'claude'
export const STDIN_MAX_BYTES = 1_048_576
export const STDIN_TIMEOUT_MS = 3000
/**
 * The only hook input fields forwarded to the app (never prompts, tool inputs or transcript paths). `error` is
 * `StopFailure`'s error kind (`rate_limit`, `authentication_failed`, …), not its details.
 */
export const PICKED_FIELDS = [
  'hook_event_name',
  'session_id',
  'notification_type',
  'tool_name',
  'source',
  'reason',
  'error',
] as const
export const EVENT_NAME_FIELD = 'hook_event_name'
export const HOOK_BUNDLE_MAX_BYTES = 65_536
/** `node <script> <EventName>`: the event name is the first user argument. */
export const ARGV_EVENT_INDEX = 2
