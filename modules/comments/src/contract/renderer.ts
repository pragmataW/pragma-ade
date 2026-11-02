import { createServiceToken } from '@pragma/sdk'
import type { ComponentType } from 'react'
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

/** Renderer service for other modules (07, 08, 11c): the composer, the drawer and the drawer's send flow. */
export interface CommentsUiService {
  CommentComposer: ComponentType<CommentComposerProps>
  openDrawer(args?: OpenDrawerArgs): void
  /**
   * Same flow as the drawer: single target → sends; several → target picker; none → launch suggestion. Resolves to
   * the SendResult, or undefined while a dialog is waiting for the user.
   */
  send(commentIds: string[], opts?: { preferredSessionId?: string }): Promise<SendResult | undefined>
}

export const CommentsUiServiceToken = createServiceToken<CommentsUiService>('comments.ui')
