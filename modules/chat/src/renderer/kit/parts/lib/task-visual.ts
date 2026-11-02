import { Bot, Timer, Workflow } from '@pragma/ui/icons'
import { type CHAT_TASK_KINDS, type CHAT_TASK_STATUSES, CHAT_TONE, TASK_KIND, TASK_STATUS } from '../../../../contract'
import type { ChatTone } from './tone'

type TaskStatus = (typeof CHAT_TASK_STATUSES)[number]
type TaskKind = (typeof CHAT_TASK_KINDS)[number]

export const TASK_TONE: Record<TaskStatus, ChatTone> = {
  [TASK_STATUS.pending]: CHAT_TONE.neutral,
  [TASK_STATUS.running]: CHAT_TONE.info,
  [TASK_STATUS.completed]: CHAT_TONE.ok,
  [TASK_STATUS.failed]: CHAT_TONE.err,
  [TASK_STATUS.killed]: CHAT_TONE.warn,
  [TASK_STATUS.paused]: CHAT_TONE.neutral,
}

export const TASK_ICONS: Record<TaskKind, typeof Bot> = {
  [TASK_KIND.subagent]: Bot,
  [TASK_KIND.workflow]: Workflow,
  [TASK_KIND.background]: Timer,
}

/** A task the user can still stop. */
export const isLiveTask = (status: TaskStatus): boolean =>
  status === TASK_STATUS.running || status === TASK_STATUS.pending || status === TASK_STATUS.paused
