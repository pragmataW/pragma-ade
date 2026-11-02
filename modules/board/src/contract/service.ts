import { createServiceToken } from '@pragma/sdk'
import { BOARD_SERVICE_ID } from './constants'
import type {
  AgentSessionId,
  BoardScope,
  BoardSection,
  BoardSnapshot,
  BranchCheck,
  ColumnDto,
  ColumnId,
  ColumnPosition,
  ColumnRef,
  CreateTaskInput,
  LabelColor,
  LabelDto,
  LabelId,
  ProjectId,
  StartInNewWorktreeInput,
  StartInWorktreeInput,
  StartPrep,
  StartTaskResult,
  TaskDto,
  TaskFilter,
  TaskId,
  TaskPosition,
  TaskRef,
  UpdateTaskPatch,
} from './dto'

/** Main-side board service (§7, §10.3). Every mutation emits `board.changed` once, whoever calls it. */
export interface BoardService {
  /** Creates the board and its default columns on first call. */
  getBoard(projectId: ProjectId): Promise<BoardSection>
  getSnapshot(scope: BoardScope): Promise<BoardSnapshot>
  /** Ordered by column order, then sort key. */
  listTasks(filter?: TaskFilter): Promise<TaskDto[]>
  getTask(ref: TaskRef): Promise<TaskDto | null>
  /** Default column = first; default position = end. */
  createTask(input: CreateTaskInput): Promise<TaskDto>
  updateTask(id: TaskId, patch: UpdateTaskPatch): Promise<TaskDto>
  deleteTask(id: TaskId): Promise<void>
  /** A string column is resolved by name within the task's own board. */
  moveTask(id: TaskId, column: ColumnRef, position?: TaskPosition): Promise<TaskDto>
  /** Idempotent. */
  linkSession(taskId: TaskId, sessionId: AgentSessionId): Promise<void>
  unlinkSession(taskId: TaskId, sessionId: AgentSessionId): Promise<void>
  createColumn(projectId: ProjectId, name: string, position?: ColumnPosition): Promise<ColumnDto>
  renameColumn(columnId: ColumnId, name: string): Promise<ColumnDto>
  moveColumn(columnId: ColumnId, position: ColumnPosition): Promise<ColumnDto>
  deleteColumn(columnId: ColumnId, opts?: { moveTasksTo?: ColumnId }): Promise<void>
  createLabel(projectId: ProjectId, name: string, color?: LabelColor): Promise<LabelDto>
  updateLabel(labelId: LabelId, patch: { name?: string; color?: LabelColor }): Promise<LabelDto>
  /** Also removes the id from every task. */
  deleteLabel(labelId: LabelId): Promise<void>
  prepareStart(taskId: TaskId): Promise<StartPrep>
  checkBranch(projectId: ProjectId, branch: string): Promise<BranchCheck>
  startInNewWorktree(input: StartInNewWorktreeInput): Promise<StartTaskResult>
  startInWorktree(input: StartInWorktreeInput): Promise<StartTaskResult>
}

export const BoardServiceToken = createServiceToken<BoardService>(BOARD_SERVICE_ID)
