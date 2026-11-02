import type { ChatSwitchMain } from './activate'

let runtime: ChatSwitchMain | undefined

/** The active module instance, for the PRAGMA_TEST hooks only. */
export const setChatSwitchRuntime = (r: ChatSwitchMain | undefined): void => {
  runtime = r
}

export class ChatSwitchNotActiveError extends Error {}

export function getChatSwitchRuntime(): ChatSwitchMain {
  if (!runtime) throw new ChatSwitchNotActiveError('chat-switch is not active')
  return runtime
}
