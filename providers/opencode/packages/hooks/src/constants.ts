export const OPENCODE_PROVIDER_ID = 'opencode'
export const OPENCODE_PLUGIN_ID = 'pragma-status'
/** Sent once when the plugin starts in a reporting process. */
export const READY_RECORD = 'pragma.ready'
export const RESUBSCRIBE_DELAY_MS = 1000

/** OpenCode 2.x bus event types (packages/schema/src/*.ts, v2.2.5). */
export const OPENCODE_EVENT_TYPES = {
  sessionCreated: 'session.created',
  inboxEnqueued: 'session.inbox.enqueued',
  inboxDelivered: 'session.inbox.delivered',
  /** Forwarded only when it withdrew the last queued prompt of a session that runs nothing (see `records.ts`). */
  inboxCancelled: 'session.inbox.cancelled',
  executionStarted: 'session.execution.started',
  executionSucceeded: 'session.execution.succeeded',
  executionFailed: 'session.execution.failed',
  executionInterrupted: 'session.execution.interrupted',
  toolInputStarted: 'session.tool.input.started',
  toolSuccess: 'session.tool.success',
  toolFailed: 'session.tool.failed',
  permissionAsked: 'permission.asked',
  permissionReplied: 'permission.replied',
  formCreated: 'form.created',
  formReplied: 'form.replied',
  formCancelled: 'form.cancelled',
} as const
export const USER_ITEM_TYPE = 'user'
