import {
  type CollisionDetection,
  closestCorners,
  type DragEndEvent,
  pointerWithin,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import type { SortingStrategy } from '@dnd-kit/sortable'
import { DND_COLUMN_PREFIX, DND_KIND, DND_TASK_PREFIX } from '../../constants'
import type { ColumnPosition, TaskDto } from '../../contract'
import { type BoardColumnModel, columnKeyOf, type DropResult, isMerged, resolveDrop } from '../model'

export type DndKind = (typeof DND_KIND)[keyof typeof DND_KIND]
export const taskDndId = (id: number): string => `${DND_TASK_PREFIX}${id}`
/** Columns stay put while one is dragged (an overlay follows the pointer), so drop targets do not move. */
export const staticColumnsStrategy: SortingStrategy = () => null
export const isColumnDrag = (id: UniqueIdentifier | null): boolean => id !== null && kindOf(id) === DND_KIND.column

export const columnDndId = (c: BoardColumnModel): string => `${DND_COLUMN_PREFIX}${columnKeyOf(c)}`
const kindOf = (id: UniqueIdentifier): DndKind | null => {
  const s = String(id)
  if (s.startsWith(DND_TASK_PREFIX)) return DND_KIND.task
  return s.startsWith(DND_COLUMN_PREFIX) ? DND_KIND.column : null
}

/**
 * Column drags only see the other columns; card drags prefer the card under the pointer, then the column under it.
 * Keyboard drags (no pointer) fall back to closest corners.
 */
export const boardCollision: CollisionDetection = (args) => {
  const columnDrag = kindOf(args.active.id) === DND_KIND.column
  const droppableContainers = args.droppableContainers.filter(
    (c) => c.id !== args.active.id && (!columnDrag || kindOf(c.id) === DND_KIND.column),
  )
  const scoped = { ...args, droppableContainers }
  const within = pointerWithin(scoped)
  const cards = within.filter((c) => kindOf(c.id) === DND_KIND.task)
  if (cards.length > 0) return cards
  return within.length > 0 ? within : closestCorners(scoped)
}

export interface BoardLayout {
  columns: readonly BoardColumnModel[]
  grouped: ReadonlyMap<string, TaskDto[]>
}

const findTask = (layout: BoardLayout, dndId: UniqueIdentifier) => {
  for (const column of layout.columns) {
    const list = layout.grouped.get(columnKeyOf(column)) ?? []
    const index = list.findIndex((t) => taskDndId(t.id) === String(dndId))
    if (index >= 0) return { column, list, index, task: list[index] as TaskDto }
  }
  return null
}

/** The card drop: between visible neighbours, as a sortable list would show it. Null when nothing moves. */
export function cardDrop(
  layout: BoardLayout,
  e: Pick<DragEndEvent, 'active' | 'over'>,
): { task: TaskDto; drop: DropResult; target: BoardColumnModel } | null {
  const from = findTask(layout, e.active.id)
  if (!from || !e.over) return null
  const overCard = findTask(layout, e.over.id)
  const target = overCard?.column ?? layout.columns.find((c) => columnDndId(c) === String(e.over?.id))
  if (!target) return null
  const visible = (layout.grouped.get(columnKeyOf(target)) ?? []).filter((t) => t.id !== from.task.id)
  const sameColumn = target === from.column
  if (overCard && sameColumn && overCard.index === from.index) return null
  const index = !overCard
    ? visible.length
    : sameColumn && from.index < overCard.index
      ? overCard.index
      : visible.findIndex((t) => t.id === overCard.task.id)
  return {
    task: from.task,
    target,
    drop: resolveDrop({ task: from.task, targetColumn: target, visibleTasks: visible, index }),
  }
}

/** The column drop as a position relative to the column it landed on (null when nothing moves). */
export function columnDrop(
  columns: readonly BoardColumnModel[],
  e: Pick<DragEndEvent, 'active' | 'over'>,
): { columnId: number; position: ColumnPosition } | null {
  const ids = columns.map(columnDndId)
  const from = ids.indexOf(String(e.active.id))
  const to = e.over ? ids.indexOf(String(e.over.id)) : -1
  const moving = columns[from]
  const anchor = columns[to]
  if (from === to || !moving || !anchor || isMerged(moving) || isMerged(anchor)) return null
  return { columnId: moving.id, position: from < to ? { afterColumnId: anchor.id } : { beforeColumnId: anchor.id } }
}
