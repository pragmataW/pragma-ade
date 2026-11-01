import { createContext, type ReactNode, useContext } from 'react'
import type { ChatSessionApi } from '../../contract'

const ChatSessionContext = createContext<ChatSessionApi | null>(null)

export class MissingChatSessionError extends Error {}

export function ChatSessionProvider({ value, children }: { value: ChatSessionApi; children?: ReactNode }) {
  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
}

/** The session of the surrounding chat view (for parts that are not handed `session` directly). */
export function useChatSessionApi(): ChatSessionApi {
  const api = useContext(ChatSessionContext)
  if (!api) throw new MissingChatSessionError('useChatSessionApi outside <ChatSessionProvider>')
  return api
}
