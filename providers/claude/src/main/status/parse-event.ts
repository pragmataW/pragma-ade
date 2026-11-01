import {
  type AgentStatusEvent,
  EVENT_KIND as K,
  WAIT_REASON,
  withExternalSessionId,
} from '@pragma/module-agent-status/contract'
import { CLAUDE_NOTIFICATION, CLAUDE_TOOL, CLAUDE_HOOK as H } from './constants'
import { type ClaudeHookPayload, readClaudeHookPayload } from './hook-events'

type EventBody = AgentStatusEvent

function preToolUse(p: ClaudeHookPayload): EventBody {
  if (p.tool_name === CLAUDE_TOOL.askUserQuestion) return { kind: K.waitingForUser, reason: WAIT_REASON.question }
  if (p.tool_name === CLAUDE_TOOL.exitPlanMode) return { kind: K.waitingForUser, reason: WAIT_REASON.input }
  return { kind: K.toolStarted, toolName: p.tool_name }
}

function notification(p: ClaudeHookPayload): EventBody | null {
  if (p.notification_type === CLAUDE_NOTIFICATION.permissionPrompt)
    return { kind: K.waitingForUser, reason: WAIT_REASON.permission }
  if (p.notification_type === CLAUDE_NOTIFICATION.elicitationDialog)
    return { kind: K.waitingForUser, reason: WAIT_REASON.question }
  return null
}

const SIMPLE: Partial<Record<string, EventBody>> = {
  [H.SessionStart]: { kind: K.sessionStarted },
  [H.UserPromptSubmit]: { kind: K.promptSubmitted },
  [H.PostToolUse]: { kind: K.toolFinished },
  [H.PostToolUseFailure]: { kind: K.toolFinished },
  [H.PermissionRequest]: { kind: K.waitingForUser, reason: WAIT_REASON.permission },
  [H.Stop]: { kind: K.turnCompleted },
  [H.StopFailure]: { kind: K.turnFailed },
  [H.SessionEnd]: { kind: K.sessionEnded },
}

function bodyFor(p: ClaudeHookPayload): EventBody | null {
  if (p.hook_event_name === H.PreToolUse) return preToolUse(p)
  if (p.hook_event_name === H.Notification) return notification(p)
  return (p.hook_event_name && SIMPLE[p.hook_event_name]) || null
}

/** Claude hook payload → status event; `externalSessionId` = Claude's `session_id`. */
export function parseClaudeHookEvent(raw: unknown): AgentStatusEvent | null {
  const p = readClaudeHookPayload(raw)
  if (!p) return null
  const body = bodyFor(p)
  if (!body) return null
  return withExternalSessionId(body, p.session_id)
}
