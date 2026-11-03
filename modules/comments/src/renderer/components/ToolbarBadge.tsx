import type { AgentSessionToolbarProps } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { COMMENTS_TESTIDS as T } from '../../contract'
import { selectPending, useCommentsStore } from '../store'
import { CommentsIconButton } from './CommentsIconButton'

/** `agentSession.toolbar`: the worktree's pending (unsent) item count; opens the drawer preferring this session as the target. */
export function ToolbarBadge({ session }: AgentSessionToolbarProps) {
  const t = useT()
  const count = useCommentsStore((s) => (s.activeWorktreeId === session.worktreeId ? selectPending(s) : 0))
  const open = () =>
    useCommentsStore.getState().openDrawer({ worktreeId: session.worktreeId, preferredSessionId: session.id })
  return <CommentsIconButton count={count} label={t('comments:toolbar.open')} testId={T.toolbarBadge} onClick={open} />
}
