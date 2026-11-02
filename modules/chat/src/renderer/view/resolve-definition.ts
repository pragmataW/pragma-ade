import type { ChatUiDefinition } from '../../contract'

/** The provider's `chatUi` definition, else the kit's default (all core parts). */
export const resolveChatUi = (
  providerId: string,
  lookup: (id: string) => ChatUiDefinition | undefined,
  fallback: ChatUiDefinition,
): ChatUiDefinition => lookup(providerId) ?? fallback
