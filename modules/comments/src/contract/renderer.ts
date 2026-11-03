import { createServiceToken } from '@pragma/sdk'
import type { ComponentType, ReactNode } from 'react'
import type { Comment, CommentContext } from './dto'
import type { OpenDrawerArgs } from './ipc'
import type { SendResult } from './results'

export const COMPOSER_RESULT = { drafted: 'drafted', sent: 'sent', saved: 'saved', cancelled: 'cancelled' } as const
export type ComposerResult =
  | { kind: 'drafted'; comment: Comment }
  | { kind: 'sent'; comment: Comment; result: SendResult }
  | { kind: 'saved'; comment: Comment }
  | { kind: 'cancelled' }

/** `CommentComposerProps.surface`: `card` (default) = own bordered box; `plain` = no box, for hosts that are one. */
export const COMPOSER_SURFACE = { card: 'card', plain: 'plain' } as const
export type ComposerSurface = (typeof COMPOSER_SURFACE)[keyof typeof COMPOSER_SURFACE]

export interface CommentComposerProps {
  worktreeId: string
  /** Where the comment points; the user types the body. */
  context: CommentContext
  /** Edit mode (only Save/Cancel). */
  editCommentId?: string
  initialBody?: string
  /** Default true. */
  autoFocus?: boolean
  /** Default true. */
  showSendNow?: boolean
  /** Called with every outcome, `cancelled` included (Cancel button or Esc in any mode); close the composer on it. */
  onDone?: (r: ComposerResult) => void
  /** Default `card`. */
  surface?: ComposerSurface
  className?: string
}

/** One review thread as every surface shows it (`CommentsUiService.ThreadView`). */
export interface ThreadViewProps {
  comment: Comment
  /** Before the location (e.g. the drawer's source icon). */
  leading?: ReactNode
  /** e.g. `src/a.ts:3-5` (drawer) or `L3–5` (diff). */
  locationLabel?: string
  /** The host's edit flow; the Edit action shows only while the root is pending. */
  onEdit?: () => void
  /** The host's delete flow (e.g. an inline confirm); default deletes the thread at once. */
  onDelete?: () => void
  /** Default `card`: own `el` card; `plain` for hosts that are the card. */
  surface?: ComposerSurface
  className?: string
}

/** Renderer service for other modules (07, 08, 11c): the composer, the thread view, the drawer and the send flow. */
export interface CommentsUiService {
  CommentComposer: ComponentType<CommentComposerProps>
  /** Replies, author badges, resolve / reopen / delete, reply box; acts through the comments IPC. */
  ThreadView: ComponentType<ThreadViewProps>
  /** Asks the user (SDK confirm dialog), then deletes the worktree's resolved threads; resolves to how many (0 = none or cancelled). */
  clearResolved(worktreeId: string): Promise<number>
  openDrawer(args?: OpenDrawerArgs): void
  /**
   * Same flow as the drawer: delivers every pending item of the worktree (default: the active one) as one review
   * round. Single target → sends; several → target picker; none → launch suggestion. Resolves to the SendResult, or
   * undefined while a dialog is waiting for the user.
   */
  send(opts?: { worktreeId?: string; preferredSessionId?: string }): Promise<SendResult | undefined>
}

export const CommentsUiServiceToken = createServiceToken<CommentsUiService>('comments.ui')
