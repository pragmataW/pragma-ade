import {
  BOARD_ERROR,
  BoardError,
  type CreateTaskInput,
  CreateTaskInputSchema,
  PRIORITY,
  type TaskDto,
  type TaskId,
  type UpdateTaskPatch,
  UpdateTaskPatchSchema,
} from '../../contract'
import { serializeLabelIds } from '../lib/mappers'
import { resolveRank } from '../rank'
import type { BoardRow } from '../schema'
import type { BoardCore } from './core'
import type { LabelOps } from './labels'

/** Creating, editing and deleting tasks. */
export function createTaskOps(core: BoardCore, labels: LabelOps) {
  const { repo } = core

  /** A worktree may only be linked to tasks of its own project. */
  async function checkWorktree(board: BoardRow, worktreeId: string | null | undefined): Promise<void> {
    if (!worktreeId) return
    const wt = await core.projects.getWorktree(worktreeId)
    if (!wt || wt.projectId !== board.projectId)
      throw new BoardError(BOARD_ERROR.validation, `worktree ${worktreeId} is not in project ${board.projectId}`)
  }

  return {
    checkWorktree,
    async createTask(raw: CreateTaskInput): Promise<TaskDto> {
      const input = CreateTaskInputSchema.parse(raw)
      const board = await core.ensureBoard(input.projectId)
      await checkWorktree(board, input.worktreeId)
      const row = repo.transaction(() => {
        const column =
          input.column === undefined ? repo.listColumns(board.id)[0] : core.resolveColumn(board, input.column)
        if (!column) throw new BoardError(BOARD_ERROR.column_not_found, `board ${board.id} has no columns`)
        const now = core.now()
        return repo.insertTask({
          boardId: board.id,
          number: repo.nextTaskNumber(board.id),
          columnId: column.id,
          title: input.title,
          descriptionMd: input.descriptionMd ?? '',
          priority: input.priority ?? PRIORITY.none,
          labelsJson: serializeLabelIds(labels.resolve(board, input.labels ?? [])),
          worktreeId: input.worktreeId ?? null,
          sortOrder: resolveRank(repo.columnTaskKeys(column.id), core.taskBounds(input.position)),
          createdAt: now,
          updatedAt: now,
        })
      })
      core.changed(board, [row.id])
      return core.taskDto(row)
    },
    async updateTask(id: TaskId, raw: UpdateTaskPatch): Promise<TaskDto> {
      const patch = UpdateTaskPatchSchema.parse(raw)
      const task = core.requireTask(id)
      const board = core.requireBoard(task.boardId)
      await checkWorktree(board, patch.worktreeId)
      const row = repo.transaction(() =>
        repo.updateTask(id, {
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.descriptionMd !== undefined && { descriptionMd: patch.descriptionMd }),
          ...(patch.priority !== undefined && { priority: patch.priority }),
          ...(patch.labels !== undefined && { labelsJson: serializeLabelIds(labels.resolve(board, patch.labels)) }),
          ...(patch.worktreeId !== undefined && { worktreeId: patch.worktreeId }),
          updatedAt: core.now(),
        }),
      )
      core.changed(board, [id])
      return core.taskDto(row)
    },
    async deleteTask(id: TaskId): Promise<void> {
      const task = core.requireTask(id)
      repo.deleteTask(id)
      core.changed(core.requireBoard(task.boardId), [id])
    },
  }
}

export type TaskOps = ReturnType<typeof createTaskOps>
