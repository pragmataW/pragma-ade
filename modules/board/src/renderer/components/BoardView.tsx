import { useT } from '@pragma/sdk/renderer'
import { useEffect, useRef } from 'react'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../../contract'
import { scopeKey } from '../../lib/scope'
import { leaveBoard } from '../lib/navigation'
import { useEscapeToLeave } from '../lib/use-escape-to-leave'
import { useBoardStore, VIEW_MODE } from '../store'
import { BoardColumns } from './BoardColumns'
import { BoardHeader } from './BoardHeader'
import { BoardList } from './BoardList'
import { ErrorBanner } from './ErrorBanner'
import { TaskDrawer } from './TaskDrawer'

/**
 * Moves keyboard focus into the board when it opens: the right dock it replaces is only collapsed, so focus would
 * otherwise stay in its (now invisible) terminal and keystrokes would go there.
 */
function useFocusOnOpen() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

/** The center view `board` (replaces center + right dock). */
export function BoardView() {
  const t = useT()
  const ref = useFocusOnOpen()
  useEscapeToLeave(leaveBoard)
  const scope = useBoardStore((s) => s.scope)
  const mode = useBoardStore((s) => s.mode)
  const projects = useBoardStore((s) => s.projects)
  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid={T.view}
      {...{ [A.scope]: scope ? scopeKey(scope) : undefined, [A.mode]: mode }}
      className="flex h-full min-h-0 flex-col bg-[var(--bg)] outline-none"
    >
      <BoardHeader />
      <ErrorBanner />
      {projects.length === 0 ? (
        <p className="p-6 text-[var(--mu)]">{t('board:empty.noProjects')}</p>
      ) : mode === VIEW_MODE.list ? (
        <BoardList />
      ) : (
        <BoardColumns />
      )}
      <TaskDrawer />
    </div>
  )
}
