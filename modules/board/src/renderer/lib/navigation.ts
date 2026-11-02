import { AGENTS_VIEW_ID, agentsCommands } from '@pragma/module-agents/contract'
import { projectsCommands } from '@pragma/module-projects/contract'
import { CoreCommands } from '@pragma/sdk'
import { BOARD_VIEW_ID } from '../../contract'
import { boardCtx } from './runtime'
import { viewHistory } from './view-history'

/** Banner messages when a jump loses the race with the session ending or the worktree being removed. */
export const GONE_NOTICE = {
  sessionKey: 'board:error.sessionGone',
  worktreeKey: 'board:error.worktreeGone',
} as const

/** Shows a center view and closes Settings (`core.activateView`). */
export const showView = async (id: string): Promise<void> => {
  await boardCtx().commands.execute(CoreCommands.activateView, { id })
}
export const showBoard = (): Promise<void> => showView(BOARD_VIEW_ID)

/** Back / Esc: the view shown before the board opened (the agents view when there is none). */
export const leaveBoard = (): Promise<void> => showView(viewHistory.backTarget())

/** Selects the worktree and shows the agents view. */
export async function goToWorktree(worktreeId: string): Promise<void> {
  await boardCtx().commands.execute(projectsCommands.selectWorktree.id, { worktreeId })
  await showView(AGENTS_VIEW_ID)
}

/** The worktree, the agents view, then the session's tab (`agents.focusSession`). */
export async function goToSession(worktreeId: string, sessionId: string): Promise<void> {
  await goToWorktree(worktreeId)
  await boardCtx().commands.execute(agentsCommands.focusSession.id, { sessionId })
}
