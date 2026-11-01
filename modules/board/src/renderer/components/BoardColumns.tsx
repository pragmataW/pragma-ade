import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useT } from '@pragma/sdk/renderer'
import { useState } from 'react'
import { DRAG_ACTIVATION_PX } from '../../constants'
import { runAction } from '../lib/actions'
import {
  boardCollision,
  cardDrop,
  columnDndId,
  columnDrop,
  isColumnDrag,
  staticColumnsStrategy,
  taskDndId,
} from '../lib/dnd'
import { useColumns, useGroupedTasks } from '../lib/use-board'
import { columnKeyOf } from '../model'
import { boardActions, setError, useBoardStore } from '../store'
import { BoardColumn } from './BoardColumn'

function useDropHandler(layout: Parameters<typeof cardDrop>[0]) {
  const t = useT()
  const sections = useBoardStore((s) => s.snapshot?.sections) ?? []
  return (e: DragEndEvent) => {
    const card = cardDrop(layout, e)
    if (card?.drop.ok) return runAction(boardActions.moveTask(card.task.id, card.drop.column, card.drop.position))
    if (card) {
      const project = sections.find((s) => s.board.id === card.task.boardId)?.projectName
      return setError(t('board:dnd.noSuchColumn', { project, column: card.target.name }))
    }
    const column = columnDrop(layout.columns, e)
    if (column) runAction(boardActions.moveColumn(column.columnId, column.position))
  }
}

/** Columns side by side (248px each, horizontal scroll); cards and (per project) columns drag with dnd-kit. */
export function BoardColumns() {
  const columns = useColumns()
  const grouped = useGroupedTasks(columns)
  const tasks = useBoardStore((s) => s.snapshot?.tasks)
  const [dragging, setDragging] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDrop = useDropHandler({ columns, grouped })
  const overlayTask = tasks?.find((x) => taskDndId(x.id) === dragging)
  const overlayColumn = columns.find((c) => columnDndId(c) === dragging)
  const overlay = overlayTask?.title ?? overlayColumn?.name
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollision}
      // Columns are few: no auto-scroll while one is dragged, so it lands where it is dropped.
      autoScroll={{ enabled: !isColumnDrag(dragging) }}
      onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(e) => {
        setDragging(null)
        onDrop(e)
      }}
    >
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
        <SortableContext items={columns.map(columnDndId)} strategy={staticColumnsStrategy}>
          {columns.map((c) => (
            <BoardColumn key={columnKeyOf(c)} column={c} tasks={grouped.get(columnKeyOf(c)) ?? []} />
          ))}
        </SortableContext>
      </div>
      <DragOverlay>
        {overlay && (
          <div className="board-column rounded-[var(--radius-card)] border border-[var(--ac)] bg-[var(--el)] p-2 text-[12.5px] shadow-lg">
            {overlay}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
