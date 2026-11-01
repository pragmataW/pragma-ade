import { projectsIpc } from '../../contract'
import type { ProjectsRuntime } from './runtime'
import { runAction } from './use-projects-action'

/** Folder picker → `addProject`; a failure lands in the sidebar error (used by the button and the command). */
export async function addProjectFlow(runtime: ProjectsRuntime): Promise<void> {
  const { path } = await runtime.ipc.invoke(projectsIpc.pickFolder, undefined)
  if (path === null) return
  const result = await runAction(runtime.ipc, projectsIpc.addProject, { path })
  runtime.ui.setState({ error: result.ok ? null : result.error })
}

/** Runs a `Result` mutation whose failure is shown as the sidebar error. */
export async function sidebarAction<I>(
  runtime: ProjectsRuntime,
  contract: Parameters<typeof runAction<I, void>>[1],
  input: I,
): Promise<void> {
  const result = await runAction(runtime.ipc, contract, input)
  if (!result.ok) runtime.ui.setState({ error: result.error })
}
