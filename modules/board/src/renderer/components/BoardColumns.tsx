import { useColumns, useGroupedTasks } from '../lib/use-board'
import { columnKeyOf } from '../model'
import { BoardColumn } from './BoardColumn'

/** Columns side by side (248px each, horizontal scroll). */
export function BoardColumns() {
  const columns = useColumns()
  const grouped = useGroupedTasks(columns)
  return (
    <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
      {columns.map((c) => (
        <BoardColumn key={columnKeyOf(c)} column={c} tasks={grouped.get(columnKeyOf(c)) ?? []} />
      ))}
    </div>
  )
}
