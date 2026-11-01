import { z } from '@pragma/sdk'
import {
  type BoardDto,
  type ColumnDto,
  type LabelDto,
  type LabelId,
  LabelIdSchema,
  type LinkedSessionDto,
  type TaskDto,
} from '../../contract'
import type { BoardRow, ColumnRow, LabelRow, TaskRow } from '../schema'

const LabelIdsJsonSchema = z.array(LabelIdSchema)
const KEY_SEPARATOR = '-'

/** `PRA-12` */
export const taskKey = (keyPrefix: string, number: number): string => `${keyPrefix}${KEY_SEPARATOR}${number}`

/** A board row always has a project in v1 (NULL = "general" is reserved, §6.3). */
export const toBoardDto = (b: BoardRow): BoardDto => ({
  id: b.id,
  projectId: b.projectId ?? '',
  name: b.name,
  keyPrefix: b.keyPrefix,
})
export const toColumnDto = (c: ColumnRow): ColumnDto => ({
  id: c.id,
  boardId: c.boardId,
  name: c.name,
  sortKey: c.sortOrder,
})
export const toLabelDto = (l: LabelRow): LabelDto => ({ id: l.id, boardId: l.boardId, name: l.name, color: l.color })

export const parseLabelIds = (json: string): LabelId[] => LabelIdsJsonSchema.parse(JSON.parse(json))
export const serializeLabelIds = (ids: readonly LabelId[]): string => JSON.stringify([...new Set(ids)])

/** `sessionIds` keeps every link; `sessions` only the ones whose record still exists. */
export function toTaskDto(
  row: TaskRow,
  board: BoardRow,
  sessionIds: string[],
  known: ReadonlyMap<string, LinkedSessionDto>,
): TaskDto {
  return {
    id: row.id,
    key: taskKey(board.keyPrefix, row.number),
    number: row.number,
    boardId: row.boardId,
    projectId: board.projectId ?? '',
    columnId: row.columnId,
    title: row.title,
    descriptionMd: row.descriptionMd,
    priority: row.priority,
    labelIds: parseLabelIds(row.labelsJson),
    worktreeId: row.worktreeId,
    sortKey: row.sortOrder,
    sessions: sessionIds.flatMap((id) => known.get(id) ?? []),
    sessionIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
