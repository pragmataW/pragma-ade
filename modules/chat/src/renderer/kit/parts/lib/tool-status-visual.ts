import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { type ChatSessionStatus, TOOL_STATUS, type TOOL_STATUSES } from '../../../../contract'

type ToolStatus = (typeof TOOL_STATUSES)[number]

/** 04's `StatusIcon` props for a tool status (ui-notes: ring = running, ✓ = done, ✗ = failed). */
export function toolStatusIcon(status: ToolStatus): { status: ChatSessionStatus; turnCompleted: boolean } {
  switch (status) {
    case TOOL_STATUS.pending:
      return { status: SESSION_STATUS.starting, turnCompleted: false }
    case TOOL_STATUS.running:
      return { status: SESSION_STATUS.working, turnCompleted: false }
    case TOOL_STATUS.completed:
      return { status: SESSION_STATUS.idle, turnCompleted: true }
    case TOOL_STATUS.error:
      return { status: SESSION_STATUS.error, turnCompleted: false }
    default: {
      const never: never = status
      return never
    }
  }
}

/** The aggregate of a tool group: any failure, else any still running/pending, else done. */
export function aggregateToolStatus(statuses: readonly ToolStatus[]): ToolStatus {
  if (statuses.includes(TOOL_STATUS.error)) return TOOL_STATUS.error
  if (statuses.includes(TOOL_STATUS.running)) return TOOL_STATUS.running
  if (statuses.includes(TOOL_STATUS.pending)) return TOOL_STATUS.pending
  return TOOL_STATUS.completed
}
