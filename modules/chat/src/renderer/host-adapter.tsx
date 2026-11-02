/** The ONLY renderer file touching SDK / 03 / 04 open shapes: builds the kit's `ChatHost` from the module context. */
import { AGENT_STATUS_MODULE_ID } from '@pragma/module-agent-status/contract'
import { StatusIcon } from '@pragma/module-agent-status/renderer'
import { MODULE_STATE } from '@pragma/sdk'
import { ProviderIcon, type RendererContext, useRendererContext, useRendererHost } from '@pragma/sdk/renderer'
import { type ComponentType, createContext, type ReactNode, useContext, useMemo } from 'react'
import { type ChatHost, type ChatSettings, chatIpc, chatIpcEvents, FILE_SEARCH_LIMIT } from '../contract'

function ProviderMark({ providerId, size }: { providerId: string; size?: number }) {
  return <ProviderIcon providerId={providerId} size={size} />
}

export function createChatHost(ctx: RendererContext<ChatSettings>, opts: { agentStatusActive: boolean }): ChatHost {
  const { ipc } = ctx
  return {
    open: (sessionId) => ipc.invoke(chatIpc.open, { sessionId }),
    onEvent: (cb) => ipc.subscribe(chatIpcEvents.event, cb),
    onComposerInboxChanged: (cb) => ipc.subscribe(chatIpcEvents.composerInboxChanged, cb),
    takeComposerInbox: async (sessionId) => (await ipc.invoke(chatIpc.takeComposerInbox, { sessionId })).entries,
    send: (sessionId, input) => ipc.invoke(chatIpc.send, { sessionId, ...input }),
    interrupt: (sessionId) => ipc.invoke(chatIpc.interrupt, { sessionId }),
    cancelQueued: (sessionId, queuedId) => ipc.invoke(chatIpc.cancelQueued, { sessionId, queuedId }),
    respondPermission: (sessionId, requestId, decision) =>
      ipc.invoke(chatIpc.respondPermission, { sessionId, requestId, decision }),
    respond: (sessionId, eventId, payload) => ipc.invoke(chatIpc.respond, { sessionId, eventId, payload }),
    setOption: (sessionId, key, value) => ipc.invoke(chatIpc.setOption, { sessionId, key, value }),
    searchFiles: (sessionId, query) => ipc.invoke(chatIpc.searchFiles, { sessionId, query, limit: FILE_SEARCH_LIMIT }),
    checkSupport: (profileId) => ipc.invoke(chatIpc.checkSupport, { profileId }),
    chatUi: (providerId) => ctx.providers.rendererCapability(providerId, 'chatUi'),
    providerName: (providerId) => {
      const key = ctx.providers.get(providerId)?.displayNameKey
      return key ? ctx.i18n.t(key) : providerId
    },
    ProviderMark,
    StatusIcon: opts.agentStatusActive ? StatusIcon : null,
    openExternal: (url) => void ctx.shell.openExternal(url),
    commands: { has: (id) => ctx.commands.has(id), execute: (id, args) => ctx.commands.execute(id, args) },
    theme: {
      get: () => ctx.theme.get().resolved,
      subscribe: (cb) => ctx.theme.onChange(() => cb()),
    },
    settings: {
      get: () => ctx.settings.get(),
      update: (patch) => ctx.settings.update(patch),
      subscribe: (cb) => ctx.settings.subscribe(cb),
    },
  }
}

const ChatHostContext = createContext<ChatHost | null>(null)

export class MissingChatHostError extends Error {}

export function ChatHostProvider({ value, children }: { value: ChatHost; children?: ReactNode }) {
  return <ChatHostContext.Provider value={value}>{children}</ChatHostContext.Provider>
}

export function useChatHost(): ChatHost {
  const host = useContext(ChatHostContext)
  if (!host) throw new MissingChatHostError('useChatHost outside <ChatHostProvider>')
  return host
}

/** The host of the chat module's own registered components (slots, settings page). */
function useModuleChatHost(): ChatHost {
  const ctx = useRendererContext<ChatSettings>()
  const { statuses } = useRendererHost()
  const agentStatusActive = statuses.some((s) => s.id === AGENT_STATUS_MODULE_ID && s.state === MODULE_STATE.active)
  return useMemo(() => createChatHost(ctx, { agentStatusActive }), [ctx, agentStatusActive])
}

/** Wraps a registered component so it (and the kit inside it) gets the module's `ChatHost`. */
export function withChatHost<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithChatHost(props: P) {
    return (
      <ChatHostProvider value={useModuleChatHost()}>
        <Component {...props} />
      </ChatHostProvider>
    )
  }
  WithChatHost.displayName = `withChatHost(${Component.displayName ?? Component.name})`
  return WithChatHost
}
