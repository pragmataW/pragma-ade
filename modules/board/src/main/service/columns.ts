import {
  BOARD_ERROR,
  BoardError,
  CHANGE_KIND,
  type ColumnDto,
  type ColumnId,
  type ColumnPosition,
  NameSchema,
} from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { compareSortKeys } from '../../lib/order'
import { toColumnDto } from '../lib/mappers'
import { rankBetween, resolveRank } from '../rank'
import type { BoardRow, ColumnRow } from '../schema'
import type { BoardCore } from './core'

/** Column management: names unique per board (case-insensitive), fractional order, never zero columns. */
export function createColumnOps(core: BoardCore) {
  const { repo } = core

  function checkName(board: BoardRow, raw: string, self?: ColumnId): string {
    const name = NameSchema.parse(raw)
    const clash = repo
      .listColumns(board.id)
      .find((c) => c.id !== self && columnMergeKey(c.name) === columnMergeKey(name))
    if (clash) throw new BoardError(BOARD_ERROR.duplicate_column_name, `column "${name}" already exists`)
    return name
  }

  /** The new key among the board's columns (without `self`); bounds outside the board are ignored. */
  function columnKey(board: BoardRow, position: ColumnPosition | undefined, self?: ColumnId): string {
    const columns = repo.listColumns(board.id).filter((c) => c.id !== self)
    const keyOf = (id: ColumnId | undefined) => columns.find((c) => c.id === id)?.sortOrder
    const afterKey = keyOf(position?.afterColumnId)
    const beforeKey = afterKey === undefined ? keyOf(position?.beforeColumnId) : undefined
    return resolveRank(
      columns.map((c) => c.sortOrder),
      { afterKey, beforeKey },
    )
  }

  function withColumn<T>(columnId: ColumnId, fn: (column: ColumnRow, board: BoardRow) => T): T {
    const column = core.requireColumn(columnId)
    return fn(column, core.requireBoard(column.boardId))
  }

  /** Moves `column`'s tasks after the target's last task, keeping their order. */
  function moveAllTasks(column: ColumnRow, target: ColumnRow): number[] {
    const tasks = repo.listTasks({ columnId: column.id })
    let lo = repo.columnTaskKeys(target.id).sort(compareSortKeys).at(-1) ?? null
    for (const t of tasks) {
      const key = rankBetween(lo, null)
      repo.updateTask(t.id, { columnId: target.id, sortOrder: key, updatedAt: core.now() })
      lo = key
    }
    return tasks.map((t) => t.id)
  }

  function deleteIn(column: ColumnRow, board: BoardRow, moveTasksTo: ColumnId | undefined): number[] {
    const columns = repo.listColumns(board.id)
    if (columns.length <= 1) throw new BoardError(BOARD_ERROR.last_column, 'a board needs at least one column')
    const hasTasks = repo.columnTaskKeys(column.id).length > 0
    if (hasTasks && moveTasksTo === undefined)
      throw new BoardError(BOARD_ERROR.validation, 'the column has tasks: moveTasksTo is required')
    const target = columns.find((c) => c.id === moveTasksTo && c.id !== column.id)
    if (hasTasks && !target)
      throw new BoardError(
        BOARD_ERROR.invalid_target_column,
        `column ${moveTasksTo} is not another column of the board`,
      )
    const moved = target ? moveAllTasks(column, target) : []
    repo.deleteColumn(column.id)
    return moved
  }

  return {
    async createColumn(projectId: string, name: string, position?: ColumnPosition): Promise<ColumnDto> {
      const board = await core.ensureBoard(projectId)
      const row = repo.transaction(() =>
        repo.insertColumn({ boardId: board.id, name: checkName(board, name), sortOrder: columnKey(board, position) }),
      )
      core.changed(board, [], CHANGE_KIND.column)
      return toColumnDto(row)
    },
    async renameColumn(columnId: ColumnId, name: string): Promise<ColumnDto> {
      const [row, board] = withColumn(
        columnId,
        (c, b) => [repo.transaction(() => repo.updateColumn(c.id, { name: checkName(b, name, c.id) })), b] as const,
      )
      core.changed(board, [], CHANGE_KIND.column)
      return toColumnDto(row)
    },
    async moveColumn(columnId: ColumnId, position: ColumnPosition): Promise<ColumnDto> {
      const [row, board] = withColumn(
        columnId,
        (c, b) =>
          [repo.transaction(() => repo.updateColumn(c.id, { sortOrder: columnKey(b, position, c.id) })), b] as const,
      )
      core.changed(board, [], CHANGE_KIND.column)
      return toColumnDto(row)
    },
    async deleteColumn(columnId: ColumnId, opts: { moveTasksTo?: ColumnId } = {}): Promise<void> {
      const [moved, board] = withColumn(
        columnId,
        (c, b) => [repo.transaction(() => deleteIn(c, b, opts.moveTasksTo)), b] as const,
      )
      core.changed(board, moved, CHANGE_KIND.column)
    },
  }
}
