import type { AgentSessionViewProps } from '@pragma/module-agents/contract'
import { type ComponentType, useEffect } from 'react'
import {
  CHAT_TESTIDS,
  type ChatItem,
  type ChatPartProps,
  type ChatSessionApi,
  type ChatUiDefinition,
  CUSTOM_PART_PREFIX,
  EVENT_KIND,
} from '../../contract'
import { useChatHost } from '../host-adapter'
import { defaultChatUi } from '../kit/default-ui'
import { ChatSessionProvider } from '../session/ChatSessionContext'
import { useChatStore } from '../session/store'
import { useChatSession } from '../session/use-chat-session'
import { resolveChatUi } from './resolve-definition'

const partKey = (item: ChatItem) => (item.kind === EVENT_KIND.custom ? `${CUSTOM_PART_PREFIX}${item.type}` : item.kind)

function ChatLayout({ api, definition }: { api: ChatSessionApi; definition: ChatUiDefinition }) {
  const parts = definition.parts as Record<string, ComponentType<ChatPartProps> | undefined>
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {definition.header?.length ? (
        <div className="flex h-8 shrink-0 items-center justify-end gap-3 border-b border-bd bg-pn px-3">
          {definition.header.map((Slot, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slot components have no identity of their own
            <Slot key={i} session={api} />
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[740px] flex-col gap-3 px-4 py-4">
          {api.transcript.items.map((item) => {
            const Part = parts[partKey(item)]
            return Part ? <Part key={`${item.kind}:${item.id}`} item={item} session={api} /> : null
          })}
        </div>
      </div>
    </div>
  )
}

/** Marks the session as the active chat (status bar) while its view is active. */
function useActiveChat(sessionId: string, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const { setActive } = useChatStore.getState()
    setActive(sessionId)
    return () => {
      if (useChatStore.getState().activeSessionId === sessionId) setActive(null)
    }
  }, [sessionId, active])
}

/** The composition root: the provider's `chatUi` definition (or the default) over the session's live state. */
export function ChatSessionView({ session, active }: AgentSessionViewProps) {
  const host = useChatHost()
  const api = useChatSession(session.id)
  useActiveChat(session.id, active)
  const definition = resolveChatUi(api?.providerId ?? session.providerId, (id) => host.chatUi(id), defaultChatUi)
  return (
    <div data-testid={CHAT_TESTIDS.view} data-session-id={session.id} className="h-full min-h-0">
      {api ? (
        <ChatSessionProvider value={api}>
          <ChatLayout api={api} definition={definition} />
        </ChatSessionProvider>
      ) : null}
    </div>
  )
}
