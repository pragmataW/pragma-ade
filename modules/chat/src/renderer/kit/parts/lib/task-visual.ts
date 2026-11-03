import { Bot, Timer, Workflow } from '@pragma/ui/icons'
import { type CHAT_TASK_KINDS, CHAT_TASK_STATUSES, CHAT_TONE, TASK_KIND, TASK_STATUS } from '../../../../contract'
import type { ChatTone } from './tone'

type TaskStatus = (typeof CHAT_TASK_STATUSES)[number]
type TaskKind = (typeof CHAT_TASK_KINDS)[number]

const TASK_TONE: Record<TaskStatus, ChatTone> = {
  [TASK_STATUS.pending]: CHAT_TONE.neutral,
  [TASK_STATUS.running]: CHAT_TONE.info,
  [TASK_STATUS.completed]: CHAT_TONE.ok,
  [TASK_STATUS.failed]: CHAT_TONE.err,
  [TASK_STATUS.killed]: CHAT_TONE.warn,
  [TASK_STATUS.paused]: CHAT_TONE.neutral,
}

const KNOWN_STATUSES = new Set<string>(CHAT_TASK_STATUSES)
const isTaskStatus = (status: string | undefined): status is TaskStatus => KNOWN_STATUSES.has(status ?? '')

/** The i18n key of a task's status label; a missing or unknown status (a newer agent's) reads a neutral one. */
export const taskStatusLabelKey = (status: string | undefined): string =>
  isTaskStatus(status) ? `chat:task.status.${status}` : 'chat:task.status.unknown'

/** The tone of a task's status; neutral for a missing or unknown one. */
export const taskTone = (status: string | undefined): ChatTone =>
  isTaskStatus(status) ? TASK_TONE[status] : CHAT_TONE.neutral

export const TASK_ICONS: Record<TaskKind, typeof Bot> = {
  [TASK_KIND.subagent]: Bot,
  [TASK_KIND.workflow]: Workflow,
  [TASK_KIND.background]: Timer,
}

/** A task the user can still stop. */
export const isLiveTask = (status: TaskStatus): boolean =>
  status === TASK_STATUS.running || status === TASK_STATUS.pending || status === TASK_STATUS.paused

/** A task's name in a one-line row: keeps room for the description beside it and truncates when very long. */
export const TASK_NAME_CLASS = 'min-w-0 max-w-[60%] shrink-0 truncate font-semibold text-tx'
