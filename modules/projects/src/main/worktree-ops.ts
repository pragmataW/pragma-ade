import type { ProjectsService } from '../contract'
import type { ServiceCore } from './projects-service'

type WorktreeOps = Pick<
  ProjectsService,
  'listBranches' | 'suggestWorktreePath' | 'createWorktree' | 'getRemovalInfo' | 'removeWorktree'
>

const NOT_YET = 'worktree operations are implemented in the next task'

/** Branch listing, path suggestion, create and remove (next task). */
export function createWorktreeOps(_core: ServiceCore): WorktreeOps {
  const pending = async (): Promise<never> => {
    throw new Error(NOT_YET)
  }
  return {
    listBranches: pending,
    suggestWorktreePath: pending,
    createWorktree: pending,
    getRemovalInfo: pending,
    removeWorktree: pending,
  }
}
