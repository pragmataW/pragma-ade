import { useLatestAsync, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pragma/ui/components/dialog'
import { useState } from 'react'
import { BUTTON_TYPES, BUTTON_VARIANTS, FIELD_IDS } from '../../constants'
import { projectsIpc, PROJECTS_TESTIDS as T, type Worktree } from '../../contract'
import { useProjects, useRuntime, useUi } from '../lib/runtime'
import { runAction, useProjectsAction } from '../lib/use-projects-action'
import { ErrorText } from './ErrorText'

function RemoveWorktreeForm({ worktree, onDone }: { worktree: Worktree; onDone(): void }) {
  const t = useT()
  const { ipc } = useRuntime()
  const [deleteBranch, setDeleteBranch] = useState(false)
  const info = useLatestAsync(
    () => runAction(ipc, projectsIpc.getRemovalInfo, { worktreeId: worktree.id }),
    [ipc, worktree.id],
  )
  const details = info.data?.ok ? info.data.value : null
  const remove = useProjectsAction(projectsIpc.removeWorktree)
  const confirm = async () => {
    if (await remove.run({ worktreeId: worktree.id, deleteBranch })) onDone()
  }
  const branch = worktree.branch ?? ''
  const changed = details?.changedFiles ?? 0
  const unmerged = details?.unmergedCommits ?? 0
  return (
    <>
      <DialogDescription className="[overflow-wrap:anywhere]">
        {t('projects:removeWorktree.body', { path: worktree.path })}
      </DialogDescription>
      {changed > 0 && (
        <p data-testid={T.removeDirtyWarning} className="text-[12px] text-warn">
          {t('projects:removeWorktree.dirtyWarning', { count: changed })}
        </p>
      )}
      {worktree.branch !== null && (
        <label htmlFor={FIELD_IDS.deleteBranch} className="flex items-center gap-2 text-[12px]">
          <input
            id={FIELD_IDS.deleteBranch}
            type="checkbox"
            data-testid={T.removeDeleteBranch}
            checked={deleteBranch}
            onChange={(e) => setDeleteBranch(e.target.checked)}
            className="accent-[var(--ac)]"
          />
          {t('projects:removeWorktree.deleteBranch', { branch })}
        </label>
      )}
      {deleteBranch && unmerged > 0 && (
        <p data-testid={T.removeUnmerged} className="text-[12px] text-warn">
          {t('projects:removeWorktree.unmerged', { count: unmerged, base: worktree.baseBranch })}
        </p>
      )}
      <ErrorText error={remove.error} />
      <DialogFooter>
        <Button type={BUTTON_TYPES.button} variant={BUTTON_VARIANTS.outline} onClick={onDone}>
          {t('projects:removeWorktree.cancel')}
        </Button>
        <Button
          type={BUTTON_TYPES.button}
          variant={BUTTON_VARIANTS.destructive}
          data-testid={T.removeConfirm}
          disabled={remove.pending}
          onClick={() => void confirm()}
        >
          {t('projects:removeWorktree.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Confirmation for `ui.removeFor`: warns about uncommitted changes, optional branch deletion. */
export function RemoveWorktreeDialog() {
  const t = useT()
  const { ui } = useRuntime()
  const worktreeId = useUi((s) => s.removeFor)
  const worktree = useProjects((s) => s.worktrees.find((w) => w.id === worktreeId) ?? null)
  const close = () => ui.setState({ removeFor: null })
  return (
    <Dialog open={worktree !== null} onOpenChange={(open) => !open && close()}>
      {worktree && (
        <DialogContent data-testid={T.removeDialog} className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {t('projects:removeWorktree.title', { branch: worktree.branch ?? t('projects:sidebar.detached') })}
            </DialogTitle>
          </DialogHeader>
          <RemoveWorktreeForm key={worktree.id} worktree={worktree} onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  )
}
