import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { NONE_WORKTREE_VALUE, SIZE, VARIANT } from '../../constants'
import { type StartPrep, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { runAction, runNavigation } from '../lib/actions'
import { isWorktreeGone } from '../lib/availability'
import { GONE_NOTICE, goToWorktree } from '../lib/navigation'
import { useWorktrees } from '../lib/use-worktrees'
import { boardActions } from '../store'
import { Hint } from './Hint'

/** Go to worktree / Start agent in this worktree; both off (with a hint) once the worktree is gone. */
function WorktreeActions(props: { worktreeId: string; startDisabled: boolean; onStartHere(): void }) {
  const t = useT()
  const gone = isWorktreeGone(props.worktreeId, useWorktrees())
  const hint = gone ? t('board:worktree.removed') : undefined
  return (
    <div className="flex flex-wrap gap-1">
      <Hint text={hint}>
        <Button
          data-testid={T.gotoWorktree}
          variant={VARIANT.outline}
          size={SIZE.xs}
          disabled={gone}
          onClick={() => runNavigation(goToWorktree(props.worktreeId), GONE_NOTICE.worktreeKey)}
        >
          {t('board:worktree.goto')}
        </Button>
      </Hint>
      <Hint text={hint}>
        <Button
          data-testid={T.startInWorktree}
          variant={VARIANT.outline}
          size={SIZE.xs}
          disabled={gone || props.startDisabled}
          onClick={props.onStartHere}
        >
          {t('board:start.inWorktree')}
        </Button>
      </Hint>
    </div>
  )
}

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
        <WorktreeActions
          worktreeId={task.worktreeId}
          startDisabled={props.running || prep.profiles.length === 0}
          onStartHere={props.onStartHere}
        />
      )}
    </div>
  )
}
