export const PROVIDER_ID = 'claude'
export const DEFAULT_COMMAND = 'claude'
/**
 * Env stamps of a parent Claude Code session (e.g. Pragma started from Claude Desktop or from `claude`'s shell);
 * a nested CLI that inherits them thinks it is that session's child and stops saving its transcript.
 */
export const CLAUDE_INHERITED_ENV = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_BRIDGE_SESSION_ID',
  // a Claude Code host's (desktop app, SDK) plumbing for its own session: a nested `claude` would talk to the
  // parent's messaging socket or wait for host-side auth refreshes that never come
  'CLAUDE_CODE_HOST_SESSION_ID',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_PID',
] as const

/** A transcript's first events carry `cwd`; never read more than this to find it. */
const KIB = 1024
const TRANSCRIPT_HEAD_KIB = 64
export const TRANSCRIPT_HEAD_BYTES = TRANSCRIPT_HEAD_KIB * KIB
