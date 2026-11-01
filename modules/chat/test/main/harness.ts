import type { ModeStartRequest, Resume } from '@pragma/module-agents/contract'
import { vi } from 'vitest'
import { type ChatEventEnvelope, type ChatSettings, chatSettingsDefaults } from '../../src/contract'
import { ChatSessionController } from '../../src/main/controller'
import { ChatSessionRegistry } from '../../src/main/registry'
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
  const deps = {
    agents,
    resolveCapability: () => (opts.noCapability ? undefined : fake.capability),
    settings: () => ({ ...chatSettingsDefaults, ...opts.settings }),
    publish: (env: ChatEventEnvelope) => void published.push(env),
    supportCache,
    statusReporter: createStatusReporter(agents),
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
