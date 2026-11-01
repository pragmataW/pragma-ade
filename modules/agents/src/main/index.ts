import { join } from 'node:path'
import { GitServiceToken, ProjectsServiceToken, worktreeRemoved } from '@pragma/module-projects/contract'
import { PtyServiceToken } from '@pragma/module-terminal/contract'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import { TEMP_ROOT_SEGMENTS } from '../constants'
import {
  AgentSessionsServiceToken,
  type AgentsSettings,
  agentsCommands,
  agentsIpcEvents,
  agentsSettingsDefaults,
  agentsSettingsSchema,
  TERMINAL_MODE,
} from '../contract'
import { registerAgentsIpc } from './ipc/register-ipc'
import { createLaunchContextFactory } from './launch/context'
import { LaunchDecoratorRegistry } from './launch/decorators'
import { createProfileChecker } from './launch/profile-check'
import { createResolve } from './launch/resolve'
import { SessionTempDirs } from './launch/session-temp'
import { ProfilesStore } from './profiles/profiles-store'
import { setMainRuntime } from './runtime'
import { AgentSessionsServiceImpl } from './service/agent-sessions-service'
import { createTerminalModeHandler } from './service/terminal-mode-handler'
import { SessionsStore } from './sessions/sessions-store'

async function activate(ctx: MainContext<AgentsSettings>): Promise<void> {
  const { log } = ctx
  const pty = ctx.services.get(PtyServiceToken)
  const projects = ctx.services.get(ProjectsServiceToken)
  const profiles = new ProfilesStore(ctx.db, ctx.providers)
  const sessions = new SessionsStore(ctx.db)
  const resolve = createResolve((cmd) => ctx.env.resolveCommand(cmd))
  const getShellEnv = () => ctx.env.getShellEnv()
  const tempDirs = new SessionTempDirs(join(ctx.paths.userData, ...TEMP_ROOT_SEGMENTS))
  const decorators = new LaunchDecoratorRegistry()
  const contextFactory = createLaunchContextFactory({ tempDirs, getShellEnv })
  const checker = createProfileChecker({ profiles, providers: ctx.providers, resolve, getShellEnv, log })
  const service = new AgentSessionsServiceImpl({
    profiles,
    sessions,
    projects,
    events: ctx.events,
    notify: (session, reveal) => ctx.ipc.publish(agentsIpcEvents.sessionChanged, { session, reveal }),
    t: (key, options) => ctx.i18n.t(key, options),
    decorators,
    contextFactory,
    tempDirs,
    log,
  })
  profiles.ensureBuiltinProfiles()
  await service.markAllEndedOnStartup()
  await tempDirs.sweepAll()
  const pipeline = { providers: ctx.providers, decorators, resolve, log }
  service.registerModeHandler(
    TERMINAL_MODE,
    createTerminalModeHandler({ pty, pipeline, contextFactory, tempDirs, log }),
  )
  ctx.services.provide(AgentSessionsServiceToken, service)
  registerAgentsIpc(ctx, { service, profiles, checker, resolve, projects, git: ctx.services.get(GitServiceToken) })
  ctx.commands.register(agentsCommands.newSession, (args) => service.startSession(args))
  ctx.events.on(worktreeRemoved, ({ worktreeId }) => {
    void service
      .listSessions(worktreeId)
      .then((open) => Promise.all(open.map((s) => service.closeSession(s.id))))
      .catch((error) => log.warn(`closing sessions of removed worktree ${worktreeId} failed`, error))
  })
  setMainRuntime({ service, profiles, checker, pty })
}

export default defineMainModule<AgentsSettings>({
  settings: { schema: agentsSettingsSchema, defaults: agentsSettingsDefaults },
  migrations: true,
  activate,
  deactivate() {
    setMainRuntime(undefined)
  },
})
