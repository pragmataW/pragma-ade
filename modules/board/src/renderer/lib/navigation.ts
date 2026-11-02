import { AGENTS_VIEW_ID, agentsCommands } from '@pragma/module-agents/contract'
import { projectsCommands } from '@pragma/module-projects/contract'
import { CoreCommands } from '@pragma/sdk'
import { BOARD_VIEW_ID } from '../../contract'
import { boardCtx } from './runtime'

/** Shows a center view and closes Settings (`core.activateView`). */
export const showView = async (id: string): Promise<void> => {
  await boardCtx().commands.execute(CoreCommands.activateView, { id })
}
export const showBoard = (): Promise<void> => showView(BOARD_VIEW_ID)
const warnLeave = (e: unknown) => console.warn('board: leaving the board failed', e)
/** Back / Esc: the main workspace view (agents). */
export const leaveBoard = (): void => void showView(AGENTS_VIEW_ID).catch(warnLeave)

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
