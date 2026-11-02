import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { toCliWorktree } from '../mappers'
import { resolveProjectId } from '../resolve-context'
import type { CliHandlerDeps } from './types'

export function worktreeHandlers({ projects }: CliHandlerDeps): Record<'worktreeList' | 'worktreeCreate', CliHandler> {
  return {
    worktreeList: defineCliHandler(CLI_METHOD.worktreeList, async (req) => {
      const projectId = await resolveProjectId(projects, req.projectId, req.context)
      const worktrees = (await projects.listWorktrees(projectId)).filter((w) => w.archivedAt === null)
      return { projectId, worktrees: worktrees.map(toCliWorktree) }
    }),
    worktreeCreate: defineCliHandler(CLI_METHOD.worktreeCreate, async (req) => {
      const projectId = await resolveProjectId(projects, req.projectId, req.context)
      const { branch, baseBranch, path } = req
      const input = { projectId, branch, ...(baseBranch ? { baseBranch } : {}), ...(path ? { path } : {}) }
      return toCliWorktree(await projects.createWorktree(input))
    }),
  }
}
