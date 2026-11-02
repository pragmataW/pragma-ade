import { AgentStatusServiceToken } from '@pragma/module-agent-status/contract'
import { AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { GitServiceToken, ProjectsServiceToken } from '@pragma/module-projects/contract'
import { defineMainModule } from '@pragma/sdk/main'
import {
  BOARD_SETTINGS_DEFAULTS,
  BoardServiceToken,
  type BoardSettings,
  BoardSettingsSchema,
  boardChanged,
} from '../contract'
import { createBoardService } from './board-service'
import { registerBoardIpc } from './ipc'
import { createBoardRepo } from './repo'
import { createSessionInfo } from './session-info'
import { wireBoardEvents } from './wiring'

export default defineMainModule<BoardSettings>({
  settings: { schema: BoardSettingsSchema, defaults: BOARD_SETTINGS_DEFAULTS },
  migrations: true,
  activate(ctx) {
    const projects = ctx.services.get(ProjectsServiceToken)
    const agentSessions = ctx.services.get(AgentSessionsServiceToken)
    const status = ctx.services.tryGet(AgentStatusServiceToken)
    const repo = createBoardRepo(ctx.db)
    const service = createBoardService({
      repo,
      projects,
      git: ctx.services.get(GitServiceToken),
      agentSessions,
      sessions: createSessionInfo({ sessions: agentSessions, status }),
      getSettings: () => ({ ...BOARD_SETTINGS_DEFAULTS, ...ctx.settings.get() }),
      emit: (p) => ctx.events.emit(boardChanged, p),
      now: Date.now,
    })
    ctx.services.provide(BoardServiceToken, service)
    registerBoardIpc(ctx.ipc, service, projects)
    wireBoardEvents(ctx, { repo, handleWorktreeRemoved: service.handleWorktreeRemoved, status })
  },
})
