import type { MainContext } from '@pragma/sdk/main'
import { PICKER_TITLE_KEY } from '../constants'
import {
  projectsIpc as I,
  PROJECTS_ERROR,
  ProjectsError,
  type ProjectsService,
  type ProjectsSettings,
  ProjectsSettingsSchema,
} from '../contract'
import { handleResult } from './lib/ipc-result'

/** Every `projects.*` handler; mutations answer `Result<T, ProjectsErrorDto>` through `handleResult`. */
export function registerProjectsIpc(ctx: MainContext<ProjectsSettings>, service: ProjectsService): void {
  const { ipc } = ctx
  ipc.handle(I.getState, () => service.getSnapshot())
  ipc.handle(I.getSettings, () => ctx.settings.get())
  ipc.handle(I.pickFolder, async () => ({ path: await ctx.dialogs.openFolder({ titleKey: PICKER_TITLE_KEY }) }))
  handleResult(ipc, I.addProject, ({ path }) => service.addProject(path))
  handleResult(ipc, I.removeProject, ({ projectId }) => service.removeProject(projectId))
  handleResult(ipc, I.reorderProjects, ({ projectIds }) => service.reorderProjects(projectIds))
  handleResult(ipc, I.syncProject, ({ projectId }) => service.syncProject(projectId))
  handleResult(ipc, I.listBranches, ({ projectId }) => service.listBranches(projectId))
  handleResult(ipc, I.suggestWorktreePath, async ({ projectId, branch }) => ({
    path: await service.suggestWorktreePath(projectId, branch),
  }))
  handleResult(ipc, I.createWorktree, async ({ select, ...input }) => {
    const worktree = await service.createWorktree(input)
    if (select !== false) await service.setActiveWorktree(worktree.id)
    return worktree
  })
  handleResult(ipc, I.getRemovalInfo, ({ worktreeId }) => service.getRemovalInfo(worktreeId))
  handleResult(ipc, I.removeWorktree, ({ worktreeId, deleteBranch }) =>
    service.removeWorktree(worktreeId, { deleteBranch }),
  )
  handleResult(ipc, I.selectWorktree, ({ worktreeId }) => service.setActiveWorktree(worktreeId))
  handleResult(ipc, I.setBaseBranch, ({ worktreeId, branch }) => service.setBaseBranch(worktreeId, branch))
  handleResult(ipc, I.updateSettings, (input) => {
    const parsed = ProjectsSettingsSchema.safeParse(input)
    if (!parsed.success) throw new ProjectsError(PROJECTS_ERROR.invalidSettings, parsed.error.message)
    return ctx.settings.set(parsed.data)
  })
}
