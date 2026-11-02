import { type AgentStatusEvent, AgentStatusServiceToken } from '@pragma/module-agent-status/contract'
import { type AgentSessionsService, AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { GitServiceToken, ProjectsServiceToken } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { GIT_LS_FILES_ARGS, LINE_SPLIT_RE } from '../constants'

type Agents = Pick<
  AgentSessionsService,
  'getSession' | 'getProfile' | 'updateSession' | 'relaunchSession' | 'registerModeHandler' | 'buildLaunchEnv'
>

/**
 * The ONLY main-side file touching 03/01/04 shapes (Upstream names in README): sessions, profiles, the env pipeline,
 * worktree files and the optional agent-status reporter.
 */
export interface ChatAgentsApi extends Agents {
  getWorktreePath(worktreeId: string): Promise<string | null>
  listWorktreeFiles(path: string): Promise<string[]>
  /** No-op when agent-status (04) is disabled. */
  reportStatus(sessionId: string, event: AgentStatusEvent): void
}

export interface AgentsApiDeps {
  agents: Agents
  projects: { getWorktree(id: string): Promise<{ path: string } | null> }
  git: { run(cwd: string, args: string[]): Promise<{ stdout: string }> }
  agentStatus?: { reportEvent(sessionId: string, event: AgentStatusEvent): Promise<boolean> }
  log: Pick<Logger, 'warn'>
}

export function createAgentsApiFrom(d: AgentsApiDeps): ChatAgentsApi {
  const { agents } = d
  return {
    getSession: (id) => agents.getSession(id),
    getProfile: (id) => agents.getProfile(id),
    updateSession: (id, patch) => agents.updateSession(id, patch),
    relaunchSession: (id, opts) => agents.relaunchSession(id, opts),
    registerModeHandler: (mode, handler) => agents.registerModeHandler(mode, handler),
    buildLaunchEnv: (ctx) => agents.buildLaunchEnv(ctx),
    getWorktreePath: async (id) => (await d.projects.getWorktree(id))?.path ?? null,
    async listWorktreeFiles(path) {
      const { stdout } = await d.git.run(path, [...GIT_LS_FILES_ARGS])
      return stdout.split(LINE_SPLIT_RE).filter((l) => l.length > 0)
    },
    reportStatus(sessionId, event) {
      d.agentStatus
        ?.reportEvent(sessionId, event)
        .catch((e: unknown) => d.log.warn(`chat: status report for ${sessionId} failed`, e))
    },
  }
}

export function createAgentsApi(ctx: MainContext): ChatAgentsApi {
  return createAgentsApiFrom({
    agents: ctx.services.get(AgentSessionsServiceToken),
    projects: ctx.services.get(ProjectsServiceToken),
    git: ctx.services.get(GitServiceToken),
    agentStatus: ctx.services.tryGet(AgentStatusServiceToken),
    log: ctx.log,
  })
}
