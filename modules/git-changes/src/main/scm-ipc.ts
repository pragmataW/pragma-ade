import type { ProjectsService } from '@pragma/module-projects/contract'
import type { MainContext } from '@pragma/sdk/main'
import {
  type ScmResult,
  scmApplyHunkIpc,
  scmCommitIpc,
  scmDiscardIpc,
  scmHunksIpc,
  scmRemoteIpc,
  scmStageIpc,
  scmStashClearIpc,
  scmStashFilesIpc,
  scmStashIpc,
  scmStashListIpc,
  scmStashPushIpc,
  scmStateIpc,
  scmUndoCommitIpc,
  scmUnstageIpc,
} from '../contract'
import type { DiffService } from './diff-service'
import { worktreeLookup } from './ipc'
import type { ScmService, ScmTarget } from './scm-service'

export interface ScmIpcDeps {
  scm: ScmService
  diff: Pick<DiffService, 'listStash'>
  projects: Pick<ProjectsService, 'getWorktree'>
}

/** The `git-changes.scm.*` handlers: the worktree path comes from projects (01), never from the renderer. */
export function registerScmIpc(ctx: Pick<MainContext, 'ipc'>, deps: ScmIpcDeps): void {
  const { scm } = deps
  const lookup = worktreeLookup(deps.projects)
  const cwdOf = async (worktreeId: string) => (await lookup(worktreeId)).path
  const target = async (worktreeId: string): Promise<ScmTarget> => ({ worktreeId, cwd: await cwdOf(worktreeId) })
  const mutation =
    <I extends { worktreeId: string }>(op: (t: ScmTarget, input: I) => Promise<ScmResult>) =>
    async (input: I) =>
      op(await target(input.worktreeId), input)

  ctx.ipc.handle(scmStateIpc, async ({ worktreeId }) => scm.state(await cwdOf(worktreeId)))
  ctx.ipc.handle(scmHunksIpc, async ({ worktreeId, path, staged }) => ({
    hunks: await scm.hunks(await cwdOf(worktreeId), path, staged),
  }))
  ctx.ipc.handle(scmStashListIpc, async ({ worktreeId }) => ({ stashes: await scm.stashes(await cwdOf(worktreeId)) }))
  ctx.ipc.handle(scmStashFilesIpc, async ({ worktreeId, sha }) => ({
    files: await deps.diff.listStash(await cwdOf(worktreeId), sha),
  }))
  ctx.ipc.handle(
    scmStageIpc,
    mutation((t, i) => scm.stage(t, i.paths)),
  )
  ctx.ipc.handle(
    scmUnstageIpc,
    mutation((t, i) => scm.unstage(t, i.paths)),
  )
  ctx.ipc.handle(
    scmDiscardIpc,
    mutation((t, i) => scm.discard(t, i.paths)),
  )
  ctx.ipc.handle(
    scmApplyHunkIpc,
    mutation((t, i) => scm.applyHunk(t, i)),
  )
  ctx.ipc.handle(
    scmCommitIpc,
    mutation((t, i) => scm.commit(t, i)),
  )
  ctx.ipc.handle(
    scmUndoCommitIpc,
    mutation((t) => scm.undoCommit(t)),
  )
  ctx.ipc.handle(
    scmStashPushIpc,
    mutation((t, i) => scm.stashPush(t, i)),
  )
  ctx.ipc.handle(
    scmStashIpc,
    mutation((t, i) => scm.stash(t, i)),
  )
  ctx.ipc.handle(
    scmStashClearIpc,
    mutation((t) => scm.stashClear(t)),
  )
  ctx.ipc.handle(
    scmRemoteIpc,
    mutation((t, i) => scm.remote(t, i.action)),
  )
}
