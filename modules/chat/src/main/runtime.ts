import type { ChatSessionRegistry } from './registry'

export interface ChatMainRuntime {
  registry: ChatSessionRegistry
}

let runtime: ChatMainRuntime | undefined

export const setChatRuntime = (r: ChatMainRuntime | undefined): void => {
  runtime = r
}

export class ChatRuntimeMissingError extends Error {}

export function getChatRuntime(): ChatMainRuntime {
  if (!runtime) throw new ChatRuntimeMissingError('chat module is not active')
  return runtime
}
