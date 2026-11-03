import { defineCommand, defineEvent, defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import {
  COMMENT_STATUS_FILTERS,
  COMMENT_STATUSES,
  CommentInputSchema,
  CommentPatchSchema,
  CommentReplySchema,
  CommentSchema,
} from './dto'
import { SendResultSchema, TargetResolutionSchema } from './results'

/** Renderer → main channels (`comments.*`). */
export const COMMENTS_CHANNELS = {
  addDraft: 'comments.addDraft',
  update: 'comments.update',
  remove: 'comments.remove',
  list: 'comments.list',
  reply: 'comments.reply',
  removeReply: 'comments.removeReply',
  setStatus: 'comments.setStatus',
  clearResolved: 'comments.clearResolved',
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
export const COMMENTS_EVENTS = {
  created: 'comment.created',
  sent: 'comment.sent',
  changed: 'comment.changed',
  replied: 'comment.replied',
  statusChanged: 'comment.statusChanged',
} as const
export const COMMENTS_COMMANDS = { openDrawer: 'comments.openDrawer' } as const

const id = z.string().min(1)
const worktreeRef = z.object({ worktreeId: id })
const comments = z.array(CommentSchema)
const commentIds = z.array(id)
/** Text the user typed in a reply box (the main side validates it with `ReplyInputSchema`). */
const replyBody = z.string()

export const commentsIpc = {
  addDraft: defineIpc({ channel: COMMENTS_CHANNELS.addDraft, input: CommentInputSchema, output: CommentSchema }),
  update: defineIpc({
    channel: COMMENTS_CHANNELS.update,
    input: z.object({ id, patch: CommentPatchSchema }),
    output: CommentSchema,
  }),
  remove: defineIpc({ channel: COMMENTS_CHANNELS.remove, input: z.object({ id }), output: z.void() }),
  /** Threads (default every status) and the last delivered round. */
  list: defineIpc({
    channel: COMMENTS_CHANNELS.list,
    input: worktreeRef.extend({ status: z.enum(COMMENT_STATUS_FILTERS).optional() }),
    output: z.object({ round: z.number().int(), threads: comments }),
  }),
  /** A user reply (pending until the next Send). */
  reply: defineIpc({
    channel: COMMENTS_CHANNELS.reply,
    input: z.object({ id, body: replyBody }),
    output: CommentSchema,
  }),
  removeReply: defineIpc({
    channel: COMMENTS_CHANNELS.removeReply,
    input: z.object({ replyId: id }),
    output: z.void(),
  }),
  setStatus: defineIpc({
    channel: COMMENTS_CHANNELS.setStatus,
    input: z.object({ id, status: z.enum(COMMENT_STATUSES) }),
    output: CommentSchema,
  }),
  clearResolved: defineIpc({
    channel: COMMENTS_CHANNELS.clearResolved,
    input: worktreeRef,
    output: z.object({ count: z.number().int() }),
  }),
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

export const CommentRepliedPayloadSchema = z.object({ comment: CommentSchema, reply: CommentReplySchema })
export type CommentRepliedPayload = z.infer<typeof CommentRepliedPayloadSchema>
export const CommentStatusChangedPayloadSchema = z.object({ comment: CommentSchema })
export type CommentStatusChangedPayload = z.infer<typeof CommentStatusChangedPayloadSchema>

export const CommentsChangedPayloadSchema = worktreeRef
export type CommentsChangedPayload = z.infer<typeof CommentsChangedPayloadSchema>

export const commentCreated = defineEvent<CommentCreatedPayload>(COMMENTS_EVENTS.created)
export const commentSent = defineEvent<CommentSentPayload>(COMMENTS_EVENTS.sent)
export const commentReplied = defineEvent<CommentRepliedPayload>(COMMENTS_EVENTS.replied)
export const commentStatusChanged = defineEvent<CommentStatusChangedPayload>(COMMENTS_EVENTS.statusChanged)
/**
 * Main-side twin of `comments.changed`: one of the worktree's threads was added, edited, replied to, resolved,
 * reopened, deleted or delivered. The generic live-update signal.
 */
export const commentsChanged = defineEvent<CommentsChangedPayload>(COMMENTS_EVENTS.changed)

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
