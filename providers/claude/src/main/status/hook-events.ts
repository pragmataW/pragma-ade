/** The fields the hook bundle forwards (see `packages/hooks/src/constants.ts` `PICKED_FIELDS`). */
export interface ClaudeHookPayload {
  hook_event_name?: string
  session_id?: string
  notification_type?: string
  tool_name?: string
  source?: string
  reason?: string
  /** `StopFailure`: the error kind that ended the turn. */
  error?: string
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** The forwarded object, or null for a non-object. */
export function readClaudeHookPayload(raw: unknown): ClaudeHookPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  return {
    hook_event_name: str(r.hook_event_name),
    session_id: str(r.session_id),
    notification_type: str(r.notification_type),
    tool_name: str(r.tool_name),
    source: str(r.source),
    reason: str(r.reason),
    error: str(r.error),
  }
}
