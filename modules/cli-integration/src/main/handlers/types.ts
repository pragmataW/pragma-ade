import type { AgentSessionsService } from '@pragma/module-agents/contract'
import type { BoardService } from '@pragma/module-board/contract'
import type { CommentsService } from '@pragma/module-comments/contract'
import type { ProjectsService } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import type { CliRequest, CliResult } from '../../contract'
import type { ProfileNamer } from '../resolve-profile'

export interface CliHandlerDeps {
  projects: ProjectsService
  agents: AgentSessionsService
  board?: BoardService
  comments?: CommentsService
  nameOf: ProfileNamer
  handoff: (req: CliRequest<'handoff'>) => Promise<CliResult<'handoff'>>
  log: Logger
}
