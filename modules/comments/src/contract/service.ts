import { createServiceToken } from '@pragma/sdk'
import type { Comment, CommentInput, CommentPatch } from './dto'
import { type SendErrorKey, type SendResult, sendErrorI18nKey, type TargetResolution } from './results'

/** What a delivery target gets; 11c may render `comments` as chips and ignores `submit`. */
export interface DeliveryRequest {
  sessionId: string
  worktreeId: string
  mode: string
  ptyId: string | null
  text: string
  comments: Comment[]
  submit: boolean
}
/** Throw to signal failure (a `CommentsError` keeps its key, anything else becomes `deliveryFailed`). */
export type DeliverFn = (req: DeliveryRequest) => Promise<void>

/** A failure with a send error key; `message` is the i18n key. */
export class CommentsError extends Error {
  readonly key: SendErrorKey
  constructor(key: SendErrorKey) {
    super(sendErrorI18nKey(key))
    this.name = 'CommentsError'
    this.key = key
  }
}

export interface SendOptions {
  /** Default true: publish `comments.sendRequested` so the UI asks the user when a target is needed. */
  promptUser?: boolean
}

export interface CommentsService {
  /** Rejects with a ZodError on invalid input. */
  addDraft(input: CommentInput): Promise<Comment>
  /** CommentsError `notFound`. */
  update(id: string, patch: CommentPatch): Promise<Comment>
  /** CommentsError `notFound`. */
  remove(id: string): Promise<void>
  /** Oldest first. Every stored comment is a draft: a successful send deletes the delivered comments. */
  listDrafts(worktreeId: string): Promise<Comment[]>
  resolveTarget(worktreeId: string, preferredSessionId?: string): Promise<TargetResolution>
  /**
   * On `sent` the delivered comments are deleted; any other result keeps them as drafts.
   * With no target: sends when exactly one running session exists. Otherwise returns needsTarget/noSession and,
   * unless `opts.promptUser === false`, publishes `comments.sendRequested` so the UI asks the user.
   */
  send(commentIds: string[], targetSessionId?: string, opts?: SendOptions): Promise<SendResult>
  /** Delivers to the next agent session started in the worktree (one pending entry per worktree). */
  sendOnNextSession(worktreeId: string, commentIds: string[]): Promise<{ pendingId: string }>
  cancelPending(worktreeId: string): void
  format(comments: Comment[]): string
  /** Returns unregister; a duplicate mode throws. */
  registerDeliveryTarget(mode: string, deliver: DeliverFn): () => void
}

export const CommentsServiceToken = createServiceToken<CommentsService>('comments.service')
