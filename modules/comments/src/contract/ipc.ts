import { defineCommand, defineEvent, defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { CommentInputSchema, CommentPatchSchema, CommentSchema } from './dto'
import { SendResultSchema, TargetResolutionSchema } from './results'

/** Renderer → main channels (`comments.*`). */
export const COMMENTS_CHANNELS = {
  addDraft: 'comments.addDraft',
  update: 'comments.update',
  remove: 'comments.remove',
  listDrafts: 'comments.listDrafts',
  resolveTarget: 'comments.resolveTarget',
  send: 'comments.send',
  sendOnNextSession: 'comments.sendOnNextSession',
  cancelPending: 'comments.cancelPending',
} as const
/** Main → renderer events. */
export const COMMENTS_IPC_EVENTS = {
  changed: 'comments.changed',
  sendRequested: 'comments.sendRequested',
  pendingDelivered: 'comments.pendingDelivered',
} as const
/** Main event bus names (§4.4). */
export const COMMENTS_EVENTS = { created: 'comment.created', sent: 'comment.sent' } as const
export const COMMENTS_COMMANDS = { openDrawer: 'comments.openDrawer' } as const

const id = z.string().min(1)
const worktreeRef = z.object({ worktreeId: id })
const comments = z.array(CommentSchema)
const commentIds = z.array(id)

export const commentsIpc = {
  addDraft: defineIpc({ channel: COMMENTS_CHANNELS.addDraft, input: CommentInputSchema, output: CommentSchema }),
  update: defineIpc({
    channel: COMMENTS_CHANNELS.update,
    input: z.object({ id, patch: CommentPatchSchema }),
    output: CommentSchema,
  }),
  remove: defineIpc({ channel: COMMENTS_CHANNELS.remove, input: z.object({ id }), output: z.void() }),
  listDrafts: defineIpc({ channel: COMMENTS_CHANNELS.listDrafts, input: worktreeRef, output: comments }),
  resolveTarget: defineIpc({
    channel: COMMENTS_CHANNELS.resolveTarget,
    input: worktreeRef.extend({ preferredSessionId: z.string().optional() }),
    output: TargetResolutionSchema,
  }),
  send: defineIpc({
    channel: COMMENTS_CHANNELS.send,
    input: z.object({ commentIds, targetSessionId: z.string().optional() }),
    output: SendResultSchema,
  }),
  sendOnNextSession: defineIpc({
    channel: COMMENTS_CHANNELS.sendOnNextSession,
    input: worktreeRef.extend({ commentIds }),
    output: z.object({ pendingId: z.string() }),
  }),
  cancelPending: defineIpc({ channel: COMMENTS_CHANNELS.cancelPending, input: worktreeRef, output: z.void() }),
} as const

export const commentsIpcEvents = {
  changed: defineIpcEvent({ channel: COMMENTS_IPC_EVENTS.changed, payload: worktreeRef }),
  sendRequested: defineIpcEvent({
    channel: COMMENTS_IPC_EVENTS.sendRequested,
    payload: worktreeRef.extend({ commentIds, result: SendResultSchema }),
  }),
  pendingDelivered: defineIpcEvent({
    channel: COMMENTS_IPC_EVENTS.pendingDelivered,
    payload: worktreeRef.extend({ result: SendResultSchema }),
  }),
} as const

export const CommentCreatedPayloadSchema = z.object({ comment: CommentSchema })
export type CommentCreatedPayload = z.infer<typeof CommentCreatedPayloadSchema>
export const CommentSentPayloadSchema = z.object({
  commentIds,
  sessionId: z.string(),
  worktreeId: z.string(),
  sentAt: z.number(),
})
export type CommentSentPayload = z.infer<typeof CommentSentPayloadSchema>

export const commentCreated = defineEvent<CommentCreatedPayload>(COMMENTS_EVENTS.created)
export const commentSent = defineEvent<CommentSentPayload>(COMMENTS_EVENTS.sent)

export const OpenDrawerArgsSchema = z.object({
  worktreeId: z.string().optional(),
  preferredSessionId: z.string().optional(),
})
export type OpenDrawerArgs = z.infer<typeof OpenDrawerArgsSchema>
/** `comments.openDrawer` (renderer). */
export const openDrawerCommand = defineCommand({
  id: COMMENTS_COMMANDS.openDrawer,
  args: OpenDrawerArgsSchema.optional(),
})
