import { useT } from '@pragma/sdk/renderer'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { useColumns, useGroupedTasks } from '../lib/use-board'
import { useWorktrees } from '../lib/use-worktrees'
import { columnKeyOf } from '../model'
import { select, useBoardStore } from '../store'
import { NoTasks } from './BoardEmpty'
import { LabelChip } from './LabelChip'
import { PriorityBars } from './PriorityBars'

const HEADERS = ['key', 'title', 'status', 'priority', 'labels', 'worktree'] as const

function Row({ task, status }: { task: TaskDto; status: string }) {
  const sections = useBoardStore((s) => s.snapshot?.sections)
  const worktrees = useWorktrees()
  const labels = sections?.find((s) => s.board.id === task.boardId)?.labels.filter((l) => task.labelIds.includes(l.id))
  return (
    <tr
      data-testid={T.listRow}
      {...{ [A.taskId]: task.id }}
      onClick={() => select(task.id)}
      className="cursor-pointer border-b border-[var(--bd)] hover:bg-[var(--hv)]"
    >
      <td className="px-2 py-1 font-mono text-[11px] text-[var(--fa)]">{task.key}</td>
      <td className="px-2 py-1">{task.title}</td>
      <td className="px-2 py-1 text-[var(--mu)]">{status}</td>
      <td className="px-2 py-1">
        <PriorityBars priority={task.priority} />
      </td>
      <td className="flex flex-wrap gap-1 px-2 py-1">
        {labels?.map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
      </td>
      <td className="px-2 py-1 font-mono text-[11px] text-[var(--mu)]">
        {task.worktreeId ? worktrees.get(task.worktreeId)?.branch : null}
      </td>
    </tr>
  )
}

/** List mode: the filtered tasks in column order; a row opens the drawer. */
export function BoardList() {
  const t = useT()
  const columns = useColumns()
  const grouped = useGroupedTasks(columns)
  const rows = columns.flatMap((c) => (grouped.get(columnKeyOf(c)) ?? []).map((task) => ({ task, status: c.name })))
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <table data-testid={T.list} className="w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--mu)] uppercase tracking-[0.06em]">
            {HEADERS.map((h) => (
              <th key={h} className="px-2 py-1 font-medium">
                {t(`board:list.${h}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.task.id} task={r.task} status={r.status} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <NoTasks />}
    </div>
  )
}
