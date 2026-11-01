import { createServiceToken } from '@pragma/sdk'
import { CHAT_SERVICE_ID } from './constants'
import type { ChatTranscript } from './transcript'

/** `ChatServiceToken` (§7): 11c delivers comments through `appendToComposer` (appended, never auto-sent). */
export interface ChatService {
  appendToComposer(sessionId: string, text: string): void
  /** The live transcript, else the dormant one rebuilt from the provider's history. */
  getHistory(sessionId: string): Promise<ChatTranscript>
}
export const ChatServiceToken = createServiceToken<ChatService>(CHAT_SERVICE_ID)
