import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { BoardServiceToken } from '@pragma/module-board/contract'
import { BridgeServerToken } from '@pragma/module-bridge/contract'
import { startTestBridgeServer } from '@pragma/module-bridge/testing'
import { CommentsServiceToken } from '@pragma/module-comments/contract'
import { fakeMainCtx } from '@pragma/module-git-changes/testing'
import { ProjectsServiceToken } from '@pragma/module-projects/contract'
import type { NotificationInput, ServiceToken } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { afterEach } from 'vitest'
import { CLI_INTEGRATION_SETTINGS_DEFAULTS, type CliIntegrationSettings } from '../../src/contract'
import mainModule from '../../src/main'
import { fakeAgents, fakeBoard, fakeComments, fakeProjects } from './fakes'

const MODULE_ROOT = join(import.meta.dirname, '..', '..')
const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
})

/**
 * The real main module activated on a fake `MainContext` with fake projects/agents/board/comments and a REAL bridge
 * server, temp userData and temp HOME. `without` leaves optional modules out.
 */
export async function activateModule(o: { without?: ('board' | 'comments')[]; shellPath?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pragma-cli-module-'))
  const userData = join(root, 'user-data')
  const bridge = await startTestBridgeServer()
  const projects = fakeProjects()
  const agents = fakeAgents()
  const services: [ServiceToken<unknown>, unknown][] = [
    [ProjectsServiceToken, projects],
    [AgentSessionsServiceToken, agents],
    [BridgeServerToken, bridge],
  ]
  if (!o.without?.includes('board')) services.push([BoardServiceToken, fakeBoard()])
  if (!o.without?.includes('comments')) services.push([CommentsServiceToken, fakeComments()])
  const fake = fakeMainCtx<CliIntegrationSettings>({ settings: CLI_INTEGRATION_SETTINGS_DEFAULTS, services })
  let settings = { ...CLI_INTEGRATION_SETTINGS_DEFAULTS }
  const notifications: NotificationInput[] = []
  const ctx = {
    ...fake.ctx,
    module: { id: 'cli-integration', version: '0.1.0', paths: { root: MODULE_ROOT, data: join(userData, 'modules', 'cli-integration') } },
    paths: { userData, logs: join(root, 'logs'), temp: join(root, 'tmp'), resource: (_id: string, rel: string) => join(MODULE_ROOT, rel) },
    env: { getShellEnv: async () => ({ PATH: o.shellPath ?? '/usr/bin:/bin' }), resolveCommand: async () => null },
    notifications: { show: (n: NotificationInput) => notifications.push(n) },
    i18n: { t: (key: string) => key },
    testMode: true,
    providers: { providersWith: () => [], capability: () => undefined, list: () => [], get: () => undefined },
    settings: {
      get: () => settings,
      set: (v: CliIntegrationSettings) => (settings = v),
      update: (patch: Partial<CliIntegrationSettings>) => (settings = { ...settings, ...patch }),
      onChange: () => ({ dispose: () => undefined }),
    },
  } as unknown as MainContext<CliIntegrationSettings>
  await mainModule.activate(ctx)
  cleanups.push(async () => {
    await mainModule.deactivate?.()
    await bridge.close()
    rmSync(root, { recursive: true, force: true })
  })
  return { ctx, fake, bridge, projects, agents, notifications, root, userData, settings: () => settings }
}
