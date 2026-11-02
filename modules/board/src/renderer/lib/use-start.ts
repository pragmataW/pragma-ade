import { useLatestAsync } from '@pragma/sdk/renderer'
import { useState } from 'react'
import { BRANCH_CHECK_DEBOUNCE_MS } from '../../constants'
import { BOARD_ERROR, errorMessage, START_STAGE, type StartTaskResult, type TaskDto } from '../../contract'
import { boardActions, select } from '../store'
import { runAction } from './actions'
import { goToSession } from './navigation'
import { useDebouncedValue } from './use-debounced-value'

/** `prepareStart` for the task, refetched when its title (branch suggestion), worktree or sessions change. */
export const useStartPrep = (task: TaskDto) =>
  useLatestAsync(
    () => boardActions.prepareStart(task.id),
    [task.id, task.title, task.worktreeId, task.sessionIds.length],
  )

/** The branch name check, debounced; `null` while unchecked. */
export function useBranchCheck(projectId: string, branch: string) {
  const debounced = useDebouncedValue(branch, BRANCH_CHECK_DEBOUNCE_MS)
  const check = useLatestAsync(() => boardActions.checkBranch(projectId, debounced), [projectId, debounced])
  return { result: debounced === branch ? (check.data ?? null) : null, pending: debounced !== branch || check.loading }
}

export type StartFailure = Extract<StartTaskResult, { ok: false }>

/**
 * Runs a start flow: on success closes the drawer and focuses the new session; a start failure stays in the drawer,
 * a failed jump to the started session goes to the banner.
 */
export function useStartRunner() {
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<StartFailure | null>(null)
  async function run(start: Promise<StartTaskResult>): Promise<void> {
    setRunning(true)
    setFailure(null)
    const result = await start.catch(
      (e: unknown): StartFailure => ({
        ok: false,
        stage: START_STAGE.validate,
        code: BOARD_ERROR.validation,
        message: errorMessage(e),
      }),
    )
    setRunning(false)
    if (!result.ok) return setFailure(result)
    // The session runs: the drawer closes, so a failed jump to it goes to the board's banner, not the drawer.
    select(null)
    runAction(goToSession(result.worktreeId, result.sessionId))
  }
  return { running, failure, run }
}
