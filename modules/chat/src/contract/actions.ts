import { z } from '@pragma/sdk'
import type { ChatSessionHandle } from './capability'
import { SESSION_ACTION as A, ACTION_KEY, CHAT_SESSION_ACTIONS } from './constants'

export type ChatSessionActionKind = (typeof CHAT_SESSION_ACTIONS)[number]

/** An optional session action (`chat.action`); each maps to one optional `ChatSessionHandle` method. */
export const chatSessionActionSchema = z.discriminatedUnion(ACTION_KEY, [
  z.object({ action: z.literal(A.toggleMcp), name: z.string(), enabled: z.boolean() }),
  z.object({ action: z.literal(A.reconnectMcp), name: z.string() }),
  z.object({ action: z.literal(A.refreshMcp) }),
  z.object({ action: z.literal(A.rewind), messageId: z.string() }),
  z.object({ action: z.literal(A.stopTask), taskId: z.string() }),
  z.object({ action: z.literal(A.fork), messageId: z.string().optional() }),
])
export type ChatSessionAction = z.infer<typeof chatSessionActionSchema>

/** The handle method behind each action. */
export const ACTION_METHOD = {
  [A.toggleMcp]: 'toggleMcp',
  [A.reconnectMcp]: 'reconnectMcp',
  [A.refreshMcp]: 'listMcp',
  [A.rewind]: 'rewind',
  [A.stopTask]: 'stopTask',
  [A.fork]: 'fork',
} as const satisfies Record<ChatSessionActionKind, keyof ChatSessionHandle>

/** The actions a handle implements. */
export const supportedActions = (handle: ChatSessionHandle): ChatSessionActionKind[] =>
  CHAT_SESSION_ACTIONS.filter((a) => typeof handle[ACTION_METHOD[a]] === 'function')

/** Whether the live session offers `action` (from `transcript.info.actions`). */
export const hasAction = (info: { actions: readonly ChatSessionActionKind[] }, action: ChatSessionActionKind) =>
  info.actions.includes(action)
