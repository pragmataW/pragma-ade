import { existsSync } from 'node:fs'
import { type AgentProfile, AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { BoardServiceToken } from '@pragma/module-board/contract'
import { BridgeServerToken } from '@pragma/module-bridge/contract'
import { CommentsServiceToken } from '@pragma/module-comments/contract'
import { ProjectsServiceToken } from '@pragma/module-projects/contract'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import {
  CLI_INTEGRATION_SETTINGS_DEFAULTS,
  CLI_MODULE_ID,
  CLI_NAMESPACE,
  CLI_PING_METHOD,
  type CliIntegrationSettings,
  cliIntegrationSettingsSchema,
} from '../contract'
import { createCliHandlers } from './handlers'
import { runHandoff } from './handoff'
import { createCliLaunchDecorator } from './launch-decorator'
import { createNotifier } from './notifier'
import { type CliPaths, resolveCliPaths } from './paths'
import { writeShims } from './shim'
import { runtimeState } from './state'

type Ctx = MainContext<CliIntegrationSettings>
const disposers: (() => void)[] = []

function cliPaths(ctx: Ctx): CliPaths {
  return resolveCliPaths({
    resource: (rel) => ctx.paths.resource(CLI_MODULE_ID, rel),
    dataDir: ctx.module.paths.data,
    userData: ctx.paths.userData,
    execPath: process.execPath,
    platform: process.platform,
    env: process.env,
  })
}

const profileNamer =
  (ctx: Ctx) =>
  (p: AgentProfile): string =>
    p.name ?? (p.displayNameKey ? ctx.i18n.t(p.displayNameKey) : p.id)

async function installShimAndDecorator(ctx: Ctx, paths: CliPaths): Promise<void> {
  await writeShims(paths, process.platform)
  if (!existsSync(paths.bundlePath))
    ctx.log.warn(`pragma CLI bundle not found at ${paths.bundlePath}; run pnpm dev/pretest so pragma.build runs`)
  const agents = ctx.services.get(AgentSessionsServiceToken)
  const basePath = async () => (await ctx.env.getShellEnv()).PATH
  disposers.push(
    agents.registerLaunchDecorator(createCliLaunchDecorator({ paths, platform: process.platform, basePath })),
  )
  ctx.log.info('cli-integration: launch decorator registered')
}

function registerBridge(ctx: Ctx): void {
  const projects = ctx.services.get(ProjectsServiceToken)
  const agents = ctx.services.get(AgentSessionsServiceToken)
  const board = ctx.services.tryGet(BoardServiceToken)
  const nameOf = profileNamer(ctx)
  const record = ctx.testMode
    ? (n: (typeof runtimeState.notifications)[number]) => runtimeState.notifications.push(n)
    : undefined
  const notifier = createNotifier({ show: (n) => ctx.notifications.show(n), record })
  const handoffDeps = { projects, agents, board, notifier, now: () => new Date(), log: ctx.log, nameOf }
  const handlers = createCliHandlers({
    projects,
    agents,
    board,
    comments: ctx.services.tryGet(CommentsServiceToken),
    nameOf,
    log: ctx.log,
    handoff: (req) => runHandoff(req, handoffDeps),
  })
  const ping = () => ({ ok: true, version: ctx.module.version })
  disposers.push(
    ctx.services.get(BridgeServerToken).registerHandler(CLI_NAMESPACE, { ...handlers, [CLI_PING_METHOD]: ping }),
  )
}

export default defineMainModule<CliIntegrationSettings>({
  settings: { schema: cliIntegrationSettingsSchema, defaults: CLI_INTEGRATION_SETTINGS_DEFAULTS },
  async activate(ctx) {
    const paths = cliPaths(ctx)
    runtimeState.paths = paths
    await installShimAndDecorator(ctx, paths)
    registerBridge(ctx)
  },
  deactivate() {
    for (const dispose of disposers.splice(0)) dispose()
  },
})
