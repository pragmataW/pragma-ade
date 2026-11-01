import { useT } from '@pragma/sdk/renderer'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../../contract'
import { scopeKey } from '../../lib/scope'
import { useBoardStore } from '../store'
import { BoardColumns } from './BoardColumns'
import { BoardHeader } from './BoardHeader'
import { ErrorBanner } from './ErrorBanner'
import { TaskDrawer } from './TaskDrawer'

/** The center view `board` (replaces center + right dock). */
export function BoardView() {
  const t = useT()
  const scope = useBoardStore((s) => s.scope)
  const mode = useBoardStore((s) => s.mode)
  const projects = useBoardStore((s) => s.projects)
  return (
    <div
      data-testid={T.view}
      {...{ [A.scope]: scope ? scopeKey(scope) : undefined, [A.mode]: mode }}
      className="flex h-full min-h-0 flex-col bg-[var(--bg)]"
    >
      <BoardHeader />
      <ErrorBanner />
      {projects.length === 0 ? <p className="p-6 text-[var(--mu)]">{t('board:empty.noProjects')}</p> : <BoardColumns />}
      <TaskDrawer />
    </div>
  )
}
