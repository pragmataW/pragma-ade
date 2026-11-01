import { GitServiceToken, ProjectsServiceToken } from '@pragma/module-projects/contract'
import { PtyServiceToken } from '@pragma/module-terminal/contract'
import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { createCommandRegistry, createEventBus } from '@pragma/sdk/runtime/main'
import { agentsSettingsDefaults } from '../../src/contract'
import { makeProviders } from './builders'
import type { TestDb } from './db'
import { fakeProjects, fakePty, recordingLog } from './fakes'
import { tUntitled } from './service'

type Handler = (input: unknown, meta: unknown) => unknown

/** A `MainContext` over a test DB, fake pty/projects/git and in-memory IPC/commands/events. */
export function fakeMainContext(db: TestDb) {
  const log = recordingLog()
  const pty = fakePty({ PATH: '/usr/bin' }, { exitOnKill: true })
  const projects = fakeProjects([
    ['w1', '/repo'],
    ['w2', '/repo-2'],
  ])
  const handlers = new Map<string, Handler>()
  const published: { channel: string; payload: unknown }[] = []
  const services = new Map<string, unknown>([
    [PtyServiceToken.id, pty.pty],
    [ProjectsServiceToken.id, projects.projects],
    [GitServiceToken.id, { defaultBaseBranch: async () => 'main' }],
  ])
  const shortcuts: unknown[] = []
  const ctx = {
    db: db.db,
    log,
    providers: makeProviders(),
    events: createEventBus(log),
    commands: createCommandRegistry({ log }),
    shortcuts: { register: (spec: unknown) => void shortcuts.push(spec) },
    i18n: { t: tUntitled },
    env: { getShellEnv: async () => ({ PATH: '/usr/bin' }), resolveCommand: async (c: string) => `/bin/${c}` },
    paths: { userData: db.dir },
    settings: { get: () => agentsSettingsDefaults },
    services: {
      get: (token: { id: string }) => services.get(token.id),
      tryGet: (token: { id: string }) => services.get(token.id),
      provide: (token: { id: string }, impl: unknown) => void services.set(token.id, impl),
    },
    ipc: {
      handle: (c: IpcContract<unknown, unknown>, h: Handler) => {
        handlers.set(c.channel, h)
        return { dispose: () => handlers.delete(c.channel) }
      },
      publish: (c: IpcEventContract<unknown>, payload: unknown) => void published.push({ channel: c.channel, payload }),
    },
  }
  /** Calls a registered handler the way the IPC router does (input and output validated). */
  async function invoke<I, O>(c: IpcContract<I, O>, input: I): Promise<O> {
    const h = handlers.get(c.channel)
    if (!h) throw new Error(`no handler for ${c.channel}`)
    return c.output.parse(await h(c.input.parse(input), {}))
  }
  return {
    ctx: ctx as unknown as MainContext<never>,
    shortcuts,
    handlers,
    published,
    services,
    pty,
    projects,
    log,
    invoke,
  }
}
