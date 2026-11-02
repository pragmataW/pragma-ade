import {
  type ChatEvent,
  type ChatMcpServer,
  ERROR_CODE,
  EVENT_KIND as K,
  MCP_SERVER_STATUSES,
} from '@pragma/module-chat/contract'
import {
  EPOCH_SECONDS_MAX,
  MCP_PENDING,
  MS_PER_SECOND,
  PERCENT,
  RATE_LIMIT_INFO_STATUS,
  SYSTEM_SUBTYPE,
} from './constants'
import { list, type Obj, obj, str } from './frame-fields'

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const epochMs = (v: unknown): number | undefined => {
  const n = finite(v)
  if (n === undefined) return undefined
  return n < EPOCH_SECONDS_MAX ? n * MS_PER_SECOND : n
}
/** 0..1 (a percentage is scaled down). */
const fraction = (v: unknown): number | undefined => {
  const n = finite(v)
  if (n === undefined || n < 0) return undefined
  return Math.min(1, n > 1 ? n / PERCENT : n)
}

/** `rate_limit_event` → `rate-limit` (utilization from the window that limits). */
export function rateLimitEvent(frame: Obj): ChatEvent[] {
  const info = obj(frame.rate_limit_info)
  const status = RATE_LIMIT_INFO_STATUS[str(info.status) as keyof typeof RATE_LIMIT_INFO_STATUS]
  if (!status) return []
  const window = str(info.rateLimitType)
  const unified = obj(obj(info.unifiedWindows)[window ?? ''])
  const utilization = fraction(info.utilization ?? unified.utilization)
  const resetsAt = epochMs(info.resetsAt)
  return [
    {
      kind: K.rateLimit,
      status,
      ...(resetsAt === undefined ? {} : { resetsAt }),
      ...(window ? { window } : {}),
      ...(utilization === undefined ? {} : { utilization }),
    },
  ]
}

function apiRetry(frame: Obj): ChatEvent[] {
  const attempt = finite(frame.attempt) ?? 1
  const maxAttempts = finite(frame.max_retries)
  const delayMs = finite(frame.retry_delay_ms)
  const reason = str(frame.error) ?? (frame.error_status ? String(frame.error_status) : undefined)
  return [
    {
      kind: K.retry,
      attempt: Math.max(1, Math.round(attempt)),
      ...(maxAttempts && maxAttempts > 0 ? { maxAttempts: Math.round(maxAttempts) } : {}),
      ...(delayMs === undefined ? {} : { delayMs: Math.max(0, Math.round(delayMs)) }),
      ...(reason ? { reason } : {}),
    },
  ]
}

/** An automatic denial (auto / dontAsk mode, rules): a non-fatal error row, nested under its subagent. */
function permissionDenied(frame: Obj): ChatEvent[] {
  const tool = str(frame.tool_name) ?? ''
  const reason = str(frame.decision_reason)
  const parentId = str(frame.agent_id)
  return [
    {
      kind: K.error,
      code: ERROR_CODE.unknown,
      message: `${tool}: ${str(frame.message) ?? ''}`,
      ...(reason ? { detail: reason } : {}),
      fatal: false,
      ...(parentId ? { parentId } : {}),
    },
  ]
}

const MCP_STATUSES = new Set<string>(MCP_SERVER_STATUSES)

/** An SDK MCP server row (`init.mcp_servers` or `mcpServerStatus()`) in the chat contract's shape. */
export function toMcpServer(s: Obj): ChatMcpServer {
  const status = str(s.status) ?? ''
  const tools = Array.isArray(s.tools) ? s.tools.length : undefined
  const error = str(s.error)
  const scope = str(s.scope) ?? str(s.source)
  return {
    name: str(s.name) ?? '',
    status: (MCP_STATUSES.has(status) ? status : MCP_PENDING) as ChatMcpServer['status'],
    ...(tools === undefined ? {} : { toolCount: tools }),
    ...(error ? { error } : {}),
    ...(scope ? { scope } : {}),
  }
}

export const mcpStatusEvent = (servers: unknown): ChatEvent => ({
  kind: K.mcpStatus,
  servers: list(servers).map(toMcpServer),
})

/** `system` subtypes mapped here (the rest stay in the mapper). */
export const SYSTEM_NOTICES: Record<string, (frame: Obj) => ChatEvent[]> = {
  [SYSTEM_SUBTYPE.apiRetry]: apiRetry,
  [SYSTEM_SUBTYPE.permissionDenied]: permissionDenied,
}
