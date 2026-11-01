import { useLatestAsync } from '@pragma/sdk/renderer'
import { useState } from 'react'
import { BRANCH_CHECK_DEBOUNCE_MS } from '../../constants'
import { BOARD_ERROR, errorMessage, START_STAGE, type StartTaskResult, type TaskDto } from '../../contract'
import { boardActions, select } from '../store'
import { goToSession } from './navigation'
import { useDebouncedValue } from './use-debounced-value'

/** `prepareStart` for the task, refetched when its worktree or sessions change. */
export const useStartPrep = (task: TaskDto) =>
  useLatestAsync(() => boardActions.prepareStart(task.id), [task.id, task.worktreeId, task.sessionIds.length])

/** The branch name check, debounced; `null` while unchecked. */
export function useBranchCheck(projectId: string, branch: string) {
  const debounced = useDebouncedValue(branch, BRANCH_CHECK_DEBOUNCE_MS)
  const check = useLatestAsync(() => boardActions.checkBranch(projectId, debounced), [projectId, debounced])
  return { result: debounced === branch ? (check.data ?? null) : null, pending: debounced !== branch || check.loading }
}

export type StartFailure = Extract<StartTaskResult, { ok: false }>

/** Runs a start flow: on success closes the drawer and focuses the new session; a failure stays in the drawer. */
export function useStartRunner() {
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<StartFailure | null>(null)
  async function run(start: Promise<StartTaskResult>): Promise<void> {
    setRunning(true)
    setFailure(null)
    try {
      const result = await start
      if (!result.ok) return setFailure(result)
      select(null)
      await goToSession(result.worktreeId, result.sessionId)
    } catch (e) {
      setFailure({ ok: false, stage: START_STAGE.validate, code: BOARD_ERROR.validation, message: errorMessage(e) })
    } finally {
      setRunning(false)
    }
  }
  return { running, failure, run }
}
