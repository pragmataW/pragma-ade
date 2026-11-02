import type { ProjectsService, Worktree } from '@pragma/module-projects/contract'
import type { MainContext } from '@pragma/sdk/main'
import {
  type BaseBranchOption,
  fileContentsIpc,
  GIT_CHANGES_ERROR_CODES,
  type GitChangesErrorCode,
  listBranchesIpc,
  listChangesIpc,
  setBaseBranchIpc,
} from '../contract'
import type { DiffService } from './diff-service'

const [WORKTREE_NOT_FOUND] = GIT_CHANGES_ERROR_CODES
const LOCAL = 'local'

/** An IPC failure; the message is the error code (it crosses IPC as `HANDLER_ERROR`). */
export class GitChangesError extends Error {
  override name = 'GitChangesError'
  readonly code: GitChangesErrorCode
  constructor(code: GitChangesErrorCode) {
    super(code)
    this.code = code
  }
}

export interface IpcDeps {
  diff: DiffService
  projects: Pick<ProjectsService, 'getWorktree' | 'listBranches' | 'setBaseBranch'>
  publishChanged(worktreeId: string): void
}

const localFirst = (a: BaseBranchOption, b: BaseBranchOption): number =>
  Number(b.kind === LOCAL) - Number(a.kind === LOCAL)

/** Looks a worktree up in projects (01); an unknown id rejects with `worktreeNotFound`. */
export const worktreeLookup =
  (projects: Pick<ProjectsService, 'getWorktree'>) =>
  async (id: string): Promise<Worktree> => {
    const wt = await projects.getWorktree(id)
    if (!wt) throw new GitChangesError(WORKTREE_NOT_FOUND)
    return wt
  }

/** The four `git-changes.*` handlers; the base branch and the worktree path always come from projects (01). */
export function registerIpc(ctx: Pick<MainContext, 'ipc'>, deps: IpcDeps): void {
  const withWorktree = worktreeLookup(deps.projects)
  ctx.ipc.handle(listChangesIpc, async ({ worktreeId, mode }) => {
    const wt = await withWorktree(worktreeId)
    return deps.diff.listChanges({ worktreeId, cwd: wt.path, mode, baseBranch: wt.baseBranch })
  })
  ctx.ipc.handle(fileContentsIpc, async ({ worktreeId, ...file }) => {
    const wt = await withWorktree(worktreeId)
    return deps.diff.getFileContents({ ...file, cwd: wt.path, baseBranch: wt.baseBranch })
  })
  ctx.ipc.handle(listBranchesIpc, async ({ worktreeId }) => {
    const wt = await withWorktree(worktreeId)
    const branches = (await deps.projects.listBranches(wt.projectId)).map(({ name, kind }) => ({ name, kind }))
    return { branches: branches.sort(localFirst) }
  })
  ctx.ipc.handle(setBaseBranchIpc, async ({ worktreeId, baseBranch }) => {
    await withWorktree(worktreeId)
    await deps.projects.setBaseBranch(worktreeId, baseBranch)
    deps.publishChanged(worktreeId)
    return {}
  })
}
