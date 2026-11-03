import type { Disposable, Logger } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import { CHAT_MODE, type ChatCapability, type ChatService, type ChatSettings, chatIpcEvents } from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import { createFileSearch } from './file-search'
import { registerChatIpc } from './ipc-handlers'
import { ChatSessionRegistry } from './registry'
import { ComposerInbox, createChatService, ResumeFallbacks, StartGuards } from './service'
import type { SessionOptionsStore } from './session-options-store'
import { createStatusReporter } from './status-reporter'
import { SupportCache } from './support-cache'
import { checkChatSupport } from './support-check'

export interface ChatMainDeps {
  agents: ChatAgentsApi
  capability(providerId: string): ChatCapability | undefined
  settings(): ChatSettings
  ipc: Pick<MainIpcApi, 'handle' | 'publish'>
  provideService(service: ChatService): void
  optionsStore?: SessionOptionsStore
  log: Pick<Logger, 'info' | 'warn'>
}

export interface ChatMain {
  registry: ChatSessionRegistry
  service: ChatService
  dispose(): Promise<void>
}

/** Wires the registry, the `chat` mode handler, IPC and `ChatServiceToken` (03 stores `mode:'chat'` itself). */
export function activateChat(d: ChatMainDeps): ChatMain {
  const supportCache = new SupportCache()
  const inbox = new ComposerInbox()
  const guards = new StartGuards()
  const fallbacks = new ResumeFallbacks()
  const resolveCapability = (p: { providerId: string }) => d.capability(p.providerId)
  const registry = new ChatSessionRegistry({
    agents: d.agents,
    resolveCapability,
    settings: d.settings,
    publish: (env) => d.ipc.publish(chatIpcEvents.event, env),
    supportCache,
    statusReporter: createStatusReporter(d.agents),
    startGuard: (s) => guards.check(s),
    onResumeFallback: fallbacks.notify,
    ...(d.optionsStore ? { optionsStore: d.optionsStore } : {}),
    log: d.log,
  })
  const disposeMode = d.agents.registerModeHandler(CHAT_MODE, {
    async start(req) {
      registry.attach(req)
      return { ptyId: null }
    },
    stop: (session, signal) => registry.stop(session, signal),
  })
  const fileSearch = createFileSearch({ listFiles: (path) => d.agents.listWorktreeFiles(path) })
  const disposables: Disposable[] = registerChatIpc(d.ipc, {
    registry,
    agents: d.agents,
    search: (path, query, limit) => fileSearch.search(path, query, limit),
    checkSupport: (profileId) => checkChatSupport({ agents: d.agents, resolveCapability, supportCache }, profileId),
    takeInbox: (sessionId) => inbox.take(sessionId),
    capability: d.capability,
  })
  const service = createChatService({
    registry,
    inbox,
    guards,
    fallbacks,
    publishInboxChanged: (sessionId) => d.ipc.publish(chatIpcEvents.composerInboxChanged, { sessionId }),
  })
  d.provideService(service)
  return {
    registry,
    service,
    async dispose() {
      await registry.closeAll()
      disposeMode()
      for (const x of disposables.splice(0)) x.dispose()
    },
  }
}
