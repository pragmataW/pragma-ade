import { useT } from '@pragma/sdk/renderer'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { scopeKey } from '../../lib/scope'
import { useColumns } from '../lib/use-board'
import { isMerged } from '../model'
import { useBoardStore } from '../store'
import { BoardHeader } from './BoardHeader'

/** The center view `board` (replaces center + right dock). */
export function BoardView() {
  const t = useT()
  const scope = useBoardStore((s) => s.scope)
  const mode = useBoardStore((s) => s.mode)
  const projects = useBoardStore((s) => s.projects)
  const columns = useColumns()
  return (
    <div
      data-testid={T.view}
      {...{ [A.scope]: scope ? scopeKey(scope) : undefined, [A.mode]: mode }}
      className="flex h-full min-h-0 flex-col bg-[var(--bg)]"
    >
      <BoardHeader />
      {projects.length === 0 ? (
        <p className="p-6 text-[var(--mu)]">{t('board:empty.noProjects')}</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
          {columns.map((c) => (
            <section
              key={isMerged(c) ? c.key : c.id}
              data-testid={T.column}
              {...{ [A.columnName]: c.name, [A.columnKeyAttr]: columnMergeKey(c.name) }}
              className="board-column"
            >
              {c.name}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
