import { existsSync } from 'node:fs'
import { ProjectsServiceToken, worktreeRemoved } from '@pragma/module-projects/contract'
import { toDisposable } from '@pragma/sdk'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import { PtyServiceToken, type TerminalSettings, terminalIpcEvents } from '../contract'
import { resolveDaemonEntry } from './daemon-entry'
import { DaemonHost } from './daemon-host'
import { inheritedEnvKeys } from './inherited-env'
import { registerIpcHandlers } from './ipc-handlers'
import { TerminalLayoutStore } from './layout-store'
import { PtyServiceImpl } from './pty-service'
import { getMainRuntime, setMainRuntime } from './runtime'
import { terminalSettings } from './settings'

async function worktreePath(ctx: MainContext<TerminalSettings>, worktreeId: string): Promise<string> {
  const worktree = await ctx.services.get(ProjectsServiceToken).getWorktree(worktreeId)
  if (!worktree) throw new Error(`terminal: unknown worktree ${worktreeId}`)
  return worktree.path
}

function activate(ctx: MainContext<TerminalSettings>): void {
  const log = ctx.log
  const host = new DaemonHost({ entryPath: resolveDaemonEntry(ctx.paths.resource, existsSync), log })
  host.start().catch((error: unknown) => log.error('terminal: pty-daemon failed to start', error))
  const pty = new PtyServiceImpl({
    host,
    shellEnv: () => ctx.env.getShellEnv(),
    resolveCommand: (cmd) => ctx.env.resolveCommand(cmd),
    settings: () => ctx.settings.get(),
    themeMode: () => ctx.theme.get().resolved,
    inheritedEnvKeys: () => inheritedEnvKeys(ctx.providers),
    platform: process.platform,
    exists: existsSync,
    log,
  })
  ctx.services.provide(PtyServiceToken, pty)
  const layouts = new TerminalLayoutStore({
    pty,
    getWorktreePath: (id) => worktreePath(ctx, id),
    onChange: (layout) => ctx.ipc.publish(terminalIpcEvents.layoutChanged, layout),
  })
  setMainRuntime({ host, pty, layouts, openExternal: (url) => ctx.shell.openExternal(url) })
  const ipc = registerIpcHandlers(ctx.ipc, { pty, layouts, openExternal: () => getMainRuntime().openExternal })
  const removed = ctx.events.on(worktreeRemoved, ({ worktreeId }) => layouts.disposeWorktree(worktreeId))
  const offRestart = host.onRestart(() => ctx.ipc.publish(terminalIpcEvents.serviceRestarted, {}))
  disposables = [ipc, removed, toDisposable(offRestart)]
}

let disposables: { dispose(): void }[] = []

export default defineMainModule<TerminalSettings>({
  settings: terminalSettings,
  activate,
  async deactivate() {
    for (const d of disposables.splice(0).reverse()) d.dispose()
    const runtime = getMainRuntime()
    setMainRuntime(undefined)
    await runtime.host.shutdown()
  },
})
