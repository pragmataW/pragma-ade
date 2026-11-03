import { type Comment, type CommentContext, CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { getRendererCtx } from '../lib/sdk'

/**
 * 05's composer for a diff range; any result (drafted, sent, saved, cancelled) closes it. With `edit` it reopens that
 * draft in edit mode (Save/Cancel), prefilled with its body.
 */
export function DiffCommentComposer(props: {
  worktreeId: string
  context: CommentContext
  edit?: Comment
  onClose(): void
}) {
  const { CommentComposer } = getRendererCtx().services.get(CommentsUiServiceToken)
  return (
    <div className="px-3 py-2 font-sans">
      <CommentComposer
        worktreeId={props.worktreeId}
        context={props.context}
        editCommentId={props.edit?.id}
        initialBody={props.edit?.body}
        autoFocus
        onDone={props.onClose}
      />
    </div>
  )
}
