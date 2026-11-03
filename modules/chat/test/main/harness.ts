import type { ModeStartRequest, Resume } from '@pragma/module-agents/contract'
import type { IpcContract, IpcEventContract, z } from '@pragma/sdk'
import { vi } from 'vitest'
import { type ChatEventEnvelope, type ChatSettings, chatSettingsDefaults } from '../../src/contract'
import { ChatSessionController } from '../../src/main/controller'
import { ChatSessionRegistry } from '../../src/main/registry'
import { SessionOptionsStore } from '../../src/main/session-options-store'
import { createStatusReporter } from '../../src/main/status-reporter'
import { SupportCache } from '../../src/main/support-cache'
import {
  createFakeChatCapability,
  type FakeChatCapabilityOptions,
  stubAgentsApi,
  TEST_WORKTREE_PATH,
} from '../../testing'

const silent = { info: vi.fn(), warn: vi.fn() }

/** Controller deps over a fake capability and the stub agents API; records published envelopes and exits. */
export function harness(
  opts: FakeChatCapabilityOptions & { noCapability?: boolean; settings?: Partial<ChatSettings> } = {},
) {
  const agents = stubAgentsApi()
  const fake = createFakeChatCapability(opts)
  const published: ChatEventEnvelope[] = []
  const exits: (number | null)[] = []
  const supportCache = new SupportCache()
  /** Shared by every controller and registry of this harness (survives a "restart": a new registry). */
  const optionsStore = new SessionOptionsStore()
  const deps = {
    agents,
    resolveCapability: () => (opts.noCapability ? undefined : fake.capability),
    settings: () => ({ ...chatSettingsDefaults, ...opts.settings }),
    publish: (env: ChatEventEnvelope) => void published.push(env),
    supportCache,
    statusReporter: createStatusReporter(agents),
    optionsStore,
    log: silent,
  }
  const session = [...agents.sessions.values()][0]
  const profile = [...agents.profiles.values()][0]
  if (!session || !profile) throw new Error('stub agents API has no session/profile')
  const request = (over: { initialPrompt?: string; resume?: Resume } = {}): ModeStartRequest => ({
    session,
    profile,
    worktree: { id: session.worktreeId, path: TEST_WORKTREE_PATH },
    reportExit: (code) => void exits.push(code),
    ...over,
  })
  const controller = () => new ChatSessionController({ ...deps, sessionId: session.id })
  const registry = () => new ChatSessionRegistry(deps)
  /** A controller attached (handshake done) to a fresh fake session. */
  const attached = async (over: Parameters<typeof request>[0] = {}) => {
    const c = controller()
    await c.attach(request(over))
    return c
  }
  const kinds = () => published.map((p) => p.event.kind)
  const statuses = () => agents.updates.flatMap((u) => (u.patch.status ? [u.patch.status] : []))
  return {
    agents,
    fake,
    published,
    exits,
    supportCache,
    optionsStore,
    deps,
    session,
    profile,
    request,
    controller,
    registry,
    attached,
    kinds,
    statuses,
  }
}

export const flush = () => new Promise((r) => setImmediate(r))

type Handler = (input: unknown, meta: never) => unknown
/** An in-memory `ctx.ipc`: `invoke` validates input and output like the SDK router. */
export function fakeIpc() {
  const handlers = new Map<string, { contract: IpcContract<unknown, unknown>; run: Handler }>()
  const published: { channel: string; payload: unknown }[] = []
  return {
    published,
    handle<I, O>(contract: IpcContract<I, O>, run: (input: I, meta: never) => O | Promise<O>) {
      handlers.set(contract.channel, { contract: contract as IpcContract<unknown, unknown>, run: run as Handler })
      return { dispose: () => handlers.delete(contract.channel) }
    },
    publish<P>(contract: IpcEventContract<P>, payload: P) {
      published.push({ channel: contract.channel, payload: contract.payload.parse(payload) })
    },
    async invoke<I, O>(contract: IpcContract<I, O>, input: z.input<IpcContract<I, O>['input']>): Promise<O> {
      const entry = handlers.get(contract.channel)
      if (!entry) throw new Error(`no handler for ${contract.channel}`)
      return contract.output.parse(await entry.run(contract.input.parse(input), undefined as never)) as O
    },
    has: (channel: string) => handlers.has(channel),
  }
}
