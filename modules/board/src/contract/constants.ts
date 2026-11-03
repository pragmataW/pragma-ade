import { keyedEnum } from '@pragma/module-agents/contract'

/** Literals shared with other modules (§9.2); module-internal ones live in `../constants.ts`. */
export const BOARD_MODULE_ID = 'board'
export const BOARD_VIEW_ID = BOARD_MODULE_ID
export const BOARD_SERVICE_ID = `${BOARD_MODULE_ID}.service`
export const BOARD_OPEN_COMMAND_ID = `${BOARD_MODULE_ID}.open`
export const BOARD_CARD_BADGES_SLOT = `${BOARD_MODULE_ID}.card.badges`
/** Main event bus: emitted once per committed mutation, whoever called the service. */
export const BOARD_CHANGED_EVENT = `${BOARD_MODULE_ID}.changed`

export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const
export const PRIORITY = keyedEnum(PRIORITIES)
export const DEFAULT_COLUMN_NAMES = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'] as const
/** The start flow moves the card here (case-insensitive); equals `DEFAULT_COLUMN_NAMES[2]`. */
export const IN_PROGRESS_COLUMN_NAME = 'In Progress'
export const LABEL_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'] as const
export const BOARD_ERROR_CODES = [
  'not_found',
  'column_not_found',
  'last_column',
  'duplicate_column_name',
  'invalid_target_column',
  'invalid_branch',
  'branch_exists',
  'worktree_failed',
  'session_failed',
  'validation',
] as const
export const BOARD_ERROR = keyedEnum(BOARD_ERROR_CODES)
export const START_STAGES = ['validate', 'worktree', 'session'] as const
export const START_STAGE = keyedEnum(START_STAGES)
export const CHANGE_KINDS = ['task', 'column', 'label', 'link', 'project'] as const
export const CHANGE_KIND = keyedEnum(CHANGE_KINDS)
export const SCOPE_KINDS = ['project', 'all'] as const
export const SCOPE_KIND = keyedEnum(SCOPE_KINDS)
export const BRANCH_CHECK_REASONS = ['invalid', 'exists'] as const
export const BRANCH_CHECK_REASON = keyedEnum(BRANCH_CHECK_REASONS)

/** Discriminator of every `{ ok: true | false }` union. */
export const RESULT_TAG = 'ok'

export const LIMITS = { titleMax: 500, descriptionMax: 100_000, nameMax: 60, columnDescriptionMax: 2000 } as const

/** IPC request channels (`board.<action>`). */
export const BOARD_CHANNELS = {
  getSnapshot: 'board.getSnapshot',
  getTask: 'board.getTask',
  createTask: 'board.createTask',
  updateTask: 'board.updateTask',
  deleteTask: 'board.deleteTask',
  moveTask: 'board.moveTask',
  unlinkSession: 'board.unlinkSession',
  createColumn: 'board.createColumn',
  renameColumn: 'board.renameColumn',
  setColumnDescription: 'board.setColumnDescription',
  moveColumn: 'board.moveColumn',
  deleteColumn: 'board.deleteColumn',
  createLabel: 'board.createLabel',
  updateLabel: 'board.updateLabel',
  deleteLabel: 'board.deleteLabel',
  prepareStart: 'board.prepareStart',
  checkBranch: 'board.checkBranch',
  startInNewWorktree: 'board.startInNewWorktree',
  startInWorktree: 'board.startInWorktree',
  resolveDefaultScope: 'board.resolveDefaultScope',
  listProjects: 'board.listProjects',
  openCount: 'board.openCount',
} as const
/** Main → renderer push events. */
export const BOARD_IPC_EVENTS = {
  changed: 'board.changedEvent',
  sessionStatusChanged: 'board.sessionStatusChangedEvent',
} as const
