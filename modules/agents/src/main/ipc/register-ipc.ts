import type { GitService } from '@pragma/module-projects/contract'
import type { MainContext } from '@pragma/sdk/main'
import { AGENTS_ERROR, AgentsError, agentsIpc, agentsIpcEvents } from '../../contract'
import type { ProfileChecker } from '../launch/profile-check'
import type { ResolveFn } from '../launch/resolve'
import type { ProfilesStore } from '../profiles/profiles-store'
import type { AgentSessionsServiceImpl } from '../service/agent-sessions-service'
import type { ProjectsAccess } from '../service/deps'

export interface AgentsIpcDeps {
  service: AgentSessionsServiceImpl
  profiles: ProfilesStore
  checker: ProfileChecker
  resolve: ResolveFn
  projects: ProjectsAccess
  git: Pick<GitService, 'defaultBaseBranch'>
}

/** Registers every `AGENTS_IPC` channel; profile mutations publish `agents.profilesChanged`. */
export function registerAgentsIpc(ctx: Pick<MainContext, 'ipc'>, deps: AgentsIpcDeps): void {
  const { service, profiles, checker } = deps
  const ipc = ctx.ipc
  const changed = <T>(value: T): T => {
    ipc.publish(agentsIpcEvents.profilesChanged, { profiles: profiles.list() })
    return value
  }

  async function newWorktreeDefaults(worktreeId: string) {
    const worktree = await deps.projects.getWorktree(worktreeId)
    if (!worktree) throw new AgentsError(AGENTS_ERROR.worktreeNotFound, { id: worktreeId })
    const project = await deps.projects.getProject(worktree.projectId)
    const baseBranch = project ? await deps.git.defaultBaseBranch(project.repoPath) : worktree.baseBranch
    return { baseBranch }
  }

  ipc.handle(agentsIpc.listProviders, () => profiles.listProviders())
  ipc.handle(agentsIpc.listProfiles, (i) => profiles.list(i ?? {}))
  ipc.handle(agentsIpc.createProfile, (i) => changed(profiles.create(i)))
  ipc.handle(agentsIpc.updateProfile, ({ id, patch }) => changed(profiles.update(id, patch)))
  ipc.handle(agentsIpc.resetProfile, ({ id }) => changed(profiles.reset(id)))
  ipc.handle(agentsIpc.setDefaultProfile, ({ id }) => changed(profiles.setDefault(id)))
  ipc.handle(agentsIpc.deleteProfile, ({ id }) => changed(profiles.remove(id)))
  ipc.handle(agentsIpc.resolveCommand, ({ command }) => deps.resolve(command))
  ipc.handle(agentsIpc.checkProfile, ({ id }) => checker.check(id))
  ipc.handle(agentsIpc.listModes, () => service.listModes())
  ipc.handle(agentsIpc.startSession, (i) => service.startSession(i))
  ipc.handle(agentsIpc.relaunchSession, ({ id, ...opts }) => service.relaunchSession(id, opts))
  ipc.handle(agentsIpc.listSessions, ({ worktreeId }) => service.listSessions(worktreeId))
  ipc.handle(agentsIpc.getSession, ({ id }) => service.getSession(id))
  ipc.handle(agentsIpc.stopSession, ({ id }) => service.stopSession(id))
  ipc.handle(agentsIpc.closeSession, ({ id }) => service.closeSession(id))
  ipc.handle(agentsIpc.focusSession, ({ id }) => service.focusSession(id))
  ipc.handle(agentsIpc.newWorktreeDefaults, ({ worktreeId }) => newWorktreeDefaults(worktreeId))
}
