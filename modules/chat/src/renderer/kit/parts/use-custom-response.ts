import type { CustomItem } from '../../../contract'
import { useChatSessionApi } from '../../session/ChatSessionContext'

/** For interactive custom parts (e.g. 11b's FormCard): whether a reply is open, and how to send it. */
export function useCustomResponse(item: CustomItem) {
  const session = useChatSessionApi()
  return {
    pending: item.awaitsResponse && !item.resolved,
    respond: (payload: unknown) => (item.eventId ? session.respond(item.eventId, payload) : Promise.resolve()),
  }
}
