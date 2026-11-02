import type { ChatService } from '@pragma/module-chat/contract'
import type { Comment, DeliverFn } from '@pragma/module-comments/contract'

const LINE_SEPARATOR = ':'
const RANGE_SEPARATOR = '-'

/** The chip tooltip line for one comment: `file:start-end`, `file:line`, `file`, or the browser element selector. */
export function chipLabelFor(c: Comment): string {
  if (!c.filePath) return c.element?.selector ?? ''
  if (c.lineStart === undefined) return c.filePath
  const range = c.lineEnd !== undefined && c.lineEnd !== c.lineStart ? `${RANGE_SEPARATOR}${c.lineEnd}` : ''
  return `${c.filePath}${LINE_SEPARATOR}${c.lineStart}${range}`
}

/** §7.5 in chat: 05's text becomes one composer chip; `submit` is ignored (the user sends). */
export const createChatDelivery =
  (chat: Pick<ChatService, 'appendToComposer'>): DeliverFn =>
  async (req) =>
    chat.appendToComposer(req.sessionId, req.text, { chipLabels: req.comments.map(chipLabelFor) })
