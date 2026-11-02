import type { Disposable } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import { type ChatSupport, type ComposerEntry, chatIpc } from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import type { ChatSessionRegistry } from './registry'

export interface ChatIpcDeps {
  registry: ChatSessionRegistry
  agents: Pick<ChatAgentsApi, 'getSession' | 'getWorktreePath'>
  search(path: string, query: string, limit: number): Promise<string[]>
  checkSupport(profileId: string): Promise<ChatSupport>
  takeInbox(sessionId: string): ComposerEntry[]
}

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
  ]
}
