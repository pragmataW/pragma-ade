import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { columnDndId, taskDndId } from '../lib/dnd'
import { useIsAllScope } from '../lib/use-board'
import { type BoardColumnModel, isMerged } from '../model'
import { select, useBoardStore } from '../store'
import { ColumnHeader } from './ColumnHeader'
import { QuickAdd } from './QuickAdd'
import { SortableTaskCard } from './SortableTaskCard'

function Cards({ tasks }: { tasks: TaskDto[] }) {
  const all = useIsAllScope()
  const sections = useBoardStore((s) => s.snapshot?.sections)
  const selectedId = useBoardStore((s) => s.selectedTaskId)
  return (
    <SortableContext items={tasks.map((t) => taskDndId(t.id))} strategy={verticalListSortingStrategy}>
      {tasks.map((task) => (
        <SortableTaskCard
          key={task.id}
          task={task}
          section={sections?.find((s) => s.board.id === task.boardId)}
          showProject={all}
          selected={task.id === selectedId}
          onOpen={() => select(task.id)}
        />
      ))}
    </SortableContext>
  )
}

/** One column: header (handle, name, count, menu), its visible cards, quick add. Columns sort only per project. */
export function BoardColumn(props: { column: BoardColumnModel; tasks: TaskDto[] }) {
  const t = useT()
  const { column, tasks } = props
  const merged = isMerged(column)
  const sortable = useSortable({ id: columnDndId(column), disabled: { draggable: merged, droppable: false } })
  const columns = useBoardStore((s) => s.snapshot?.sections[0]?.columns) ?? []
  const total = useBoardStore((s) => s.snapshot?.tasks.filter((x) => !merged && x.columnId === column.id).length) ?? 0
  const count = (
    <span
      data-testid={T.columnCount}
      title={t('board:column.count', { count: tasks.length })}
      className="shrink-0 text-[11px] text-[var(--fa)]"
    >
      {tasks.length}
    </span>
  )
  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      data-testid={T.column}
      {...{
        [A.columnName]: column.name,
        [A.columnKeyAttr]: columnMergeKey(column.name),
        [A.columnId]: merged ? undefined : column.id,
        [A.dropTarget]: sortable.isOver,
      }}
      className={cn(
        'board-column flex max-h-full flex-col rounded-[var(--radius-card)] bg-[var(--pn)]',
        sortable.isDragging && 'opacity-40',
      )}
    >
      <header className="flex h-9 shrink-0 items-center gap-1.5 px-2">
        {merged ? (
          <>
            <span className="truncate font-medium text-[12.5px]">{column.name}</span>
            {count}
          </>
        ) : (
          <ColumnHeader column={column} columns={columns} taskCount={total} count={count} handle={sortable.listeners} />
        )}
      </header>
      <div className="flex min-h-10 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <Cards tasks={tasks} />
        <QuickAdd column={column} />
      </div>
    </section>
  )
}
