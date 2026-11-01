import { useT } from '@pragma/sdk/renderer'
import type { ReactNode } from 'react'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { useIsAllScope } from '../lib/use-board'
import { type BoardColumnModel, isMerged } from '../model'
import { select, useBoardStore } from '../store'
import { QuickAdd } from './QuickAdd'
import { TaskCard } from './TaskCard'

/** One column: header (name, count, actions), its visible cards, quick add. */
export function BoardColumn(props: { column: BoardColumnModel; tasks: TaskDto[]; header?: ReactNode }) {
  const t = useT()
  const { column, tasks } = props
  const all = useIsAllScope()
  const sections = useBoardStore((s) => s.snapshot?.sections)
  const selectedId = useBoardStore((s) => s.selectedTaskId)
  return (
    <section
      data-testid={T.column}
      {...{
        [A.columnName]: column.name,
        [A.columnKeyAttr]: columnMergeKey(column.name),
        [A.columnId]: isMerged(column) ? undefined : column.id,
      }}
      className="board-column flex max-h-full flex-col rounded-[var(--radius-card)] bg-[var(--pn)]"
    >
      <header className="flex h-9 shrink-0 items-center gap-2 px-2">
        {props.header ?? <span className="truncate font-medium text-[12.5px]">{column.name}</span>}
        <span
          data-testid={T.columnCount}
          title={t('board:column.count', { count: tasks.length })}
          className="text-[11px] text-[var(--fa)]"
        >
          {tasks.length}
        </span>
      </header>
      <div className="flex min-h-10 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            section={sections?.find((s) => s.board.id === task.boardId)}
            showProject={all}
            selected={task.id === selectedId}
            onOpen={() => select(task.id)}
          />
        ))}
        <QuickAdd column={column} />
      </div>
    </section>
  )
}
