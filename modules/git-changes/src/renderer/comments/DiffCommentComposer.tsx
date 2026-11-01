import { type CommentContext, CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { getRendererCtx } from '../lib/sdk'

/** 05's composer for a diff range; any result (drafted, sent, cancelled) closes it. */
export function DiffCommentComposer(props: { worktreeId: string; context: CommentContext; onClose(): void }) {
  const { CommentComposer } = getRendererCtx().services.get(CommentsUiServiceToken)
  return (
    <div className="px-3 py-2 font-sans">
      <CommentComposer worktreeId={props.worktreeId} context={props.context} autoFocus onDone={props.onClose} />
    </div>
  )
}
