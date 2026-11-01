import { ProjectsError, type ProjectsRendererService, projectsIpc } from '../contract'
import { type ProjectsIpc, type ProjectsStore, selectActiveWorktree } from './store'

/** `ProjectsRendererServiceToken`: the active-worktree context other renderer modules read. */
export function createProjectsRendererService(store: ProjectsStore, ipc: ProjectsIpc): ProjectsRendererService {
  return {
    getSnapshot: () => store.getState(),
    getActiveWorktree: () => selectActiveWorktree(store.getState()),
    subscribe: (listener) => store.subscribe(listener),
    async selectWorktree(id) {
      const result = await ipc.invoke(projectsIpc.selectWorktree, { worktreeId: id })
      if (!result.ok) throw new ProjectsError(result.error.code, result.error.detail)
    },
  }
}
