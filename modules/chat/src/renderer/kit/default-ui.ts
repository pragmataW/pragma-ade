import type { ChatUiDefinition } from '../../contract'

/** The kit's definition for providers without a `chatUi` capability (all core parts). */
export const defaultChatUi: ChatUiDefinition = {
  parts: {},
  groupToolCalls: true,
}
