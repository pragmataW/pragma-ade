import { useT } from '@pragma/sdk/renderer'
import { DropdownMenuItem } from '@pragma/ui/components/dropdown-menu'
import { PROJECTS_TESTIDS as T, type Worktree } from '../../contract'
import { useRuntime } from '../lib/runtime'
import { RowMenu } from './RowMenu'

/** Row actions; the main checkout has none (it cannot be removed). */
export function WorktreeMenu({ worktree }: { worktree: Worktree }) {
  const t = useT()
  const runtime = useRuntime()
  if (worktree.isMain) return null
  return (
    <RowMenu label={t('projects:sidebar.worktreeMenu')} testId={T.worktreeMenu}>
      <DropdownMenuItem data-testid={T.worktreeRemove} onSelect={() => runtime.ui.setState({ removeFor: worktree.id })}>
        {t('projects:sidebar.removeWorktree')}
      </DropdownMenuItem>
    </RowMenu>
  )
}
