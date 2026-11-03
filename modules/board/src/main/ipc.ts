import type { ProjectsService } from '@pragma/module-projects/contract'
import { type Disposable, err, type IpcContract, ok, type Result } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import {
  type BoardErrorDto,
  type BoardScope,
  type BoardService,
  boardIpc as I,
  SCOPE_KIND,
  toBoardErrorDto,
} from '../contract'
import { openCount } from '../lib/snapshot'

/** Runs `fn`; a thrown error becomes the `BoardErrorDto` value (codes survive IPC). */
async function asResult<O>(fn: () => O | Promise<O>): Promise<Result<O, BoardErrorDto>> {
  let value: O
  try {
    value = await fn()
  } catch (e) {
    return err(toBoardErrorDto(e))
  }
  return ok(value)
}

type ScopeProjects = Pick<ProjectsService, 'getActiveWorktreeId' | 'getWorktree' | 'listProjects'>

/** The active worktree's project, else the first project, else All projects. */
export async function resolveDefaultScope(projects: ScopeProjects): Promise<BoardScope> {
  const active = projects.getActiveWorktreeId()
  const wt = active ? await projects.getWorktree(active) : null
  const projectId = wt?.projectId ?? (await projects.listProjects())[0]?.id
  return projectId ? { kind: SCOPE_KIND.project, projectId } : { kind: SCOPE_KIND.all }
}

/** Every `board.*` channel; inputs are validated by the router against the contract schemas. */
export function registerBoardIpc(ipc: Pick<MainIpcApi, 'handle'>, service: BoardService, projects: ScopeProjects) {
  const h = <In, Out>(c: IpcContract<In, Result<Out, BoardErrorDto>>, fn: (i: In) => Out | Promise<Out>): Disposable =>
    ipc.handle(c, (input) => asResult(() => fn(input)))
  h(I.getSnapshot, ({ scope }) => service.getSnapshot(scope))
  h(I.getTask, ({ ref }) => service.getTask(ref))
  h(I.createTask, (input) => service.createTask(input))
  h(I.updateTask, ({ id, patch }) => service.updateTask(id, patch))
  h(I.deleteTask, ({ id }) => service.deleteTask(id))
  h(I.moveTask, ({ id, column, position }) => service.moveTask(id, column, position))
  h(I.unlinkSession, ({ taskId, sessionId }) => service.unlinkSession(taskId, sessionId))
  h(I.createColumn, ({ projectId, name, position }) => service.createColumn(projectId, name, position))
  h(I.renameColumn, ({ columnId, name }) => service.renameColumn(columnId, name))
  h(I.setColumnDescription, ({ columnId, description }) => service.setColumnDescription(columnId, description))
  h(I.moveColumn, ({ columnId, position }) => service.moveColumn(columnId, position))
  h(I.deleteColumn, ({ columnId, moveTasksTo }) => service.deleteColumn(columnId, { moveTasksTo }))
  h(I.createLabel, ({ projectId, name, color }) => service.createLabel(projectId, name, color))
  h(I.updateLabel, ({ labelId, patch }) => service.updateLabel(labelId, patch))
  h(I.deleteLabel, ({ labelId }) => service.deleteLabel(labelId))
  h(I.prepareStart, ({ taskId }) => service.prepareStart(taskId))
  h(I.checkBranch, ({ projectId, branch }) => service.checkBranch(projectId, branch))
  h(I.startInNewWorktree, (input) => service.startInNewWorktree(input))
  h(I.startInWorktree, (input) => service.startInWorktree(input))
  h(I.resolveDefaultScope, () => resolveDefaultScope(projects))
  h(I.listProjects, async () => (await projects.listProjects()).map((p) => ({ id: p.id, name: p.name })))
  h(I.openCount, async ({ scope }) => ({ open: openCount(await service.getSnapshot(scope)) }))
}
