import type { AgentSessionsService } from '@pragma/module-agents/contract'
import type { GitService } from '@pragma/module-projects/contract'
import { BOARD_ERROR, BoardError, type BoardService, type BoardSettings } from '../contract'
import { type BoardCoreDeps, createBoardCore } from './service/core'
import { createLabelOps } from './service/labels'
import { createReads } from './service/reads'
import { createTaskOps } from './service/tasks'

export interface BoardServiceDeps extends BoardCoreDeps {
  git: Pick<GitService, 'isValidBranchName' | 'defaultBaseBranch'>
  agentSessions: Pick<AgentSessionsService, 'listProfiles' | 'getProfile' | 'getSession' | 'startSession'>
  getSettings(): BoardSettings
}

const notImplemented = (): never => {
  throw new BoardError(BOARD_ERROR.validation, 'not implemented')
}

/** The concrete service: `BoardService` plus internal hooks used by the module wiring. */
export function createBoardService(deps: BoardServiceDeps) {
  const core = createBoardCore(deps)
  const labels = createLabelOps(core)
  const tasks = createTaskOps(core, labels)
  const reads = createReads(core)
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
    moveTask: async () => notImplemented(),
    linkSession: async () => notImplemented(),
    unlinkSession: async () => notImplemented(),
    createColumn: async () => notImplemented(),
    renameColumn: async () => notImplemented(),
    moveColumn: async () => notImplemented(),
    deleteColumn: async () => notImplemented(),
    prepareStart: async () => notImplemented(),
    checkBranch: async () => notImplemented(),
    startInNewWorktree: async () => notImplemented(),
    startInWorktree: async () => notImplemented(),
  }
  return service
}

export type BoardServiceImpl = ReturnType<typeof createBoardService>
