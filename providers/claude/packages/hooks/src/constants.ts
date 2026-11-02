export const CLAUDE_PROVIDER_ID = 'claude'
export const STDIN_MAX_BYTES = 1_048_576
export const STDIN_TIMEOUT_MS = 3000
/**
 * The only hook input fields forwarded to the app (never prompts or tool inputs). `error` is `StopFailure`'s error
 * kind (`rate_limit`, `authentication_failed`, …), not its details. The transcript path is forwarded separately
 * (`TRANSCRIPT_PATH_FIELD`).
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
/**
 * `transcript_path`, forwarded whole (never truncated) when it is an absolute `.jsonl` path of at most
 * `TRANSCRIPT_PATH_MAX_CHARS`: the app watches it for the interrupt marker Claude writes (no hook reports an
 * interrupted turn). Only the path is sent, never transcript content.
 */
export const TRANSCRIPT_PATH_FIELD = 'transcript_path'
export const TRANSCRIPT_PATH_MAX_CHARS = 4096
export const TRANSCRIPT_EXTENSION = '.jsonl'
