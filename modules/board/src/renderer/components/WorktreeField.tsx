import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { NONE_WORKTREE_VALUE, SIZE, VARIANT } from '../../constants'
import { type StartPrep, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { runAction } from '../lib/actions'
import { goToWorktree } from '../lib/navigation'
import { boardActions } from '../store'

/** Link to an existing worktree (or none); when linked: Go to worktree / Start agent in this worktree. */
export function WorktreeField(props: { task: TaskDto; prep: StartPrep; running: boolean; onStartHere(): void }) {
  const t = useT()
  const { task, prep } = props
  const link = (v: string) =>
    runAction(boardActions.updateTask(task.id, { worktreeId: v === NONE_WORKTREE_VALUE ? null : v }))
  return (
    <div className="flex flex-col gap-1.5">
      <Select value={task.worktreeId ?? NONE_WORKTREE_VALUE} onValueChange={link}>
        <SelectTrigger
          data-testid={T.drawerWorktree}
          size={SIZE.sm}
          aria-label={t('board:worktree.link')}
          className="w-full font-mono text-[12px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_WORKTREE_VALUE}>{t('board:worktree.none')}</SelectItem>
          {prep.worktrees.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.branch ?? t('board:worktree.detached')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {task.worktreeId && (
        <div className="flex flex-wrap gap-1">
          <Button
            data-testid={T.gotoWorktree}
            variant={VARIANT.outline}
            size={SIZE.xs}
            onClick={() => runAction(goToWorktree(task.worktreeId as string))}
          >
            {t('board:worktree.goto')}
          </Button>
          <Button
            data-testid={T.startInWorktree}
            variant={VARIANT.outline}
            size={SIZE.xs}
            disabled={props.running || prep.profiles.length === 0}
            onClick={props.onStartHere}
          >
            {t('board:start.inWorktree')}
          </Button>
        </div>
      )}
    </div>
  )
}
