import type { AgentSessionViewProps } from '@pragma/module-agents/contract'
import { useEffect } from 'react'
import { CHAT_TESTIDS, type ChatSessionApi, type ChatSlotComponent, type ChatUiDefinition } from '../../contract'
import { useChatHost } from '../host-adapter'
import { defaultChatUi } from '../kit/default-ui'
import { AssistantTurnHeader } from '../kit/parts/AssistantTurnHeader'
import { MessageList } from '../kit/parts/MessageList'
import { WorkingLine } from '../kit/parts/WorkingLine'
import { ChatSessionProvider } from '../session/ChatSessionContext'
import { useChatStore } from '../session/store'
import { useChatSession } from '../session/use-chat-session'
import { resolveChatUi } from './resolve-definition'

function SlotRow({ slots, session }: { slots: ChatSlotComponent[] | undefined; session: ChatSessionApi }) {
  return (
    <>
      {(slots ?? []).map((Slot, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: slot components have no identity of their own
        <Slot key={i} session={session} />
      ))}
    </>
  )
}

function ChatLayout({ api, definition }: { api: ChatSessionApi; definition: ChatUiDefinition }) {
  const turnHeader = definition.turnHeader === undefined ? AssistantTurnHeader : definition.turnHeader
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {definition.header?.length ? (
        <div className="flex h-8 shrink-0 items-center justify-end gap-3 border-b border-bd bg-pn px-3">
          <SlotRow slots={definition.header} session={api} />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <MessageList
          items={api.transcript.items}
          parts={definition.parts}
          groupToolCalls={definition.groupToolCalls ?? true}
          turnHeader={turnHeader}
          session={api}
        />
        {definition.sidePanels?.length ? (
          <div className="flex w-72 shrink-0 flex-col gap-2 border-l border-bd bg-pn p-2">
            <SlotRow slots={definition.sidePanels} session={api} />
          </div>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-[740px] px-4">
        <WorkingLine session={api} />
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
