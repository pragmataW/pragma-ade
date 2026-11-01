import type { AgentSessionsService } from '@pragma/module-agents/contract'
import type { GitService } from '@pragma/module-projects/contract'
import type { BoardService, BoardSettings } from '../contract'
import { createColumnOps } from './service/columns'
import { type BoardCoreDeps, createBoardCore } from './service/core'
import { createLabelOps } from './service/labels'
import { createLinkOps } from './service/links'
import { createReads } from './service/reads'
import { createTaskOps } from './service/tasks'
import { createTaskLauncher } from './task-launcher'

export interface BoardServiceDeps extends BoardCoreDeps {
  git: Pick<GitService, 'isValidBranchName' | 'defaultBaseBranch'>
  agentSessions: Pick<AgentSessionsService, 'listProfiles' | 'getProfile' | 'getSession' | 'startSession'>
  getSettings(): BoardSettings
}

/** The concrete service: `BoardService` plus internal hooks used by the module wiring. */
export function createBoardService(deps: BoardServiceDeps) {
  const core = createBoardCore(deps)
  const labels = createLabelOps(core)
  const tasks = createTaskOps(core, labels)
  const reads = createReads(core)
  const columns = createColumnOps(core)
  const links = createLinkOps(core)
  const service: BoardService = {
    getBoard: reads.getBoard,
    getSnapshot: reads.getSnapshot,
    listTasks: reads.listTasks,
    getTask: reads.getTask,
    createTask: tasks.createTask,
    updateTask: tasks.updateTask,
    deleteTask: tasks.deleteTask,
    createLabel: labels.createLabel,
    updateLabel: labels.updateLabel,
    deleteLabel: labels.deleteLabel,
    moveTask: tasks.moveTask,
    linkSession: links.linkSession,
    unlinkSession: links.unlinkSession,
    createColumn: columns.createColumn,
    renameColumn: columns.renameColumn,
    moveColumn: columns.moveColumn,
    deleteColumn: columns.deleteColumn,
    prepareStart: (taskId) => launcher.prepareStart(taskId),
    checkBranch: (projectId, branch) => launcher.checkBranch(projectId, branch),
    startInNewWorktree: (input) => launcher.startInNewWorktree(input),
    startInWorktree: (input) => launcher.startInWorktree(input),
  }
  const launcher = createTaskLauncher({
    service,
    projects: deps.projects,
    git: deps.git,
    sessions: deps.agentSessions,
    getSettings: deps.getSettings,
  })
  return { ...service, handleWorktreeRemoved: links.handleWorktreeRemoved }
}

export type BoardServiceImpl = ReturnType<typeof createBoardService>
