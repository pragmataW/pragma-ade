import type { ChatService } from '../contract'
import type { ChatSessionRegistry } from './registry'

export function createChatService(deps: {
  registry: Pick<ChatSessionRegistry, 'snapshot'>
  publishAppend(sessionId: string, text: string): void
}): ChatService {
  return {
    appendToComposer: (sessionId, text) => deps.publishAppend(sessionId, text),
    getHistory: async (sessionId) => (await deps.registry.snapshot(sessionId)).transcript,
  }
}
