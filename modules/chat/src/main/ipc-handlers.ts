import type { Disposable } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import {
  type ChatCapability,
  type ChatSupport,
  type ComposerEntry,
  chatIpc,
  PROVIDER_CALL_UNSUPPORTED_KEY,
} from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import type { ChatSessionRegistry } from './registry'

export interface ChatIpcDeps {
  registry: ChatSessionRegistry
  agents: Pick<ChatAgentsApi, 'getSession' | 'getWorktreePath'>
  search(path: string, query: string, limit: number): Promise<string[]>
  checkSupport(profileId: string): Promise<ChatSupport>
  takeInbox(sessionId: string): ComposerEntry[]
  capability(providerId: string): Pick<ChatCapability, 'settingsCall'> | undefined
}

export class ProviderCallUnsupportedError extends Error {}

/** The `chat.*` invoke handlers; each routes to the session's controller. */
export function registerChatIpc(ipc: Pick<MainIpcApi, 'handle'>, d: ChatIpcDeps): Disposable[] {
  const controller = (id: string) => d.registry.open(id)
  return [
    ipc.handle(chatIpc.open, async ({ sessionId }) => {
      const snapshot = await d.registry.snapshot(sessionId)
      const session = await d.agents.getSession(sessionId)
      const path = session ? await d.agents.getWorktreePath(session.worktreeId) : null
      return session && path ? { ...snapshot, worktree: { id: session.worktreeId, path } } : snapshot
    }),
    ipc.handle(chatIpc.send, async ({ sessionId, ...input }) => (await controller(sessionId)).send(input)),
    ipc.handle(chatIpc.cancelQueued, async ({ sessionId, queuedId }) =>
      (await controller(sessionId)).cancelQueued(queuedId),
    ),
    ipc.handle(chatIpc.interrupt, async ({ sessionId }) => (await controller(sessionId)).interrupt()),
    ipc.handle(chatIpc.respondPermission, async ({ sessionId, requestId, decision }) =>
      (await controller(sessionId)).respondPermission(requestId, decision),
    ),
    ipc.handle(chatIpc.respond, async ({ sessionId, eventId, payload }) =>
      (await controller(sessionId)).respond(eventId, payload),
    ),
    ipc.handle(chatIpc.action, async ({ sessionId, action }) => (await controller(sessionId)).action(action)),
    ipc.handle(chatIpc.setOption, async ({ sessionId, key, value }) =>
      (await controller(sessionId)).setOption(key, value),
    ),
    ipc.handle(chatIpc.searchFiles, async ({ sessionId, query, limit }) => {
      const session = await d.agents.getSession(sessionId)
      const path = session ? await d.agents.getWorktreePath(session.worktreeId) : null
      return path ? d.search(path, query, limit) : []
    }),
    ipc.handle(chatIpc.checkSupport, ({ profileId }) => d.checkSupport(profileId)),
    ipc.handle(chatIpc.takeComposerInbox, ({ sessionId }) => ({ entries: d.takeInbox(sessionId) })),
    ipc.handle(chatIpc.providerCall, async ({ providerId, request }) => {
      const call = d.capability(providerId)?.settingsCall
      if (!call) throw new ProviderCallUnsupportedError(PROVIDER_CALL_UNSUPPORTED_KEY)
      return call(request)
    }),
  ]
}
