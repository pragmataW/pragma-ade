import { StatusIcon } from '@pragma/module-agent-status/renderer'
import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { SIZE, VARIANT } from '../../constants'
import { BOARD_TESTID_ATTRS as A, type LinkedSessionDto, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { runAction, runNavigation } from '../lib/actions'
import { SESSION_AVAILABILITY, sessionAvailability, unavailableHintKey } from '../lib/availability'
import { profileLabel } from '../lib/labels'
import { GONE_NOTICE, goToSession } from '../lib/navigation'
import { useWorktrees } from '../lib/use-worktrees'
import { boardActions, useBoardStore } from '../store'
import { Hint } from './Hint'
import { SectionTitle } from './SectionTitle'

/** One linked session: status, title, agent, Go to agent (off once the session ended or its worktree is gone), Unlink. */
function SessionRow({ task, s, worktrees }: { task: TaskDto; s: LinkedSessionDto; worktrees: Map<string, unknown> }) {
  const t = useT()
  const statusAvailable = useBoardStore((st) => st.snapshot?.statusAvailable ?? false)
  const availability = sessionAvailability(s, worktrees)
  const open = availability === SESSION_AVAILABILITY.open
  const hintKey = unavailableHintKey(availability)
  return (
    <div
      data-testid={T.drawerSession}
      {...{ [A.sessionId]: s.sessionId, [A.status]: s.status ?? undefined, [A.availability]: availability }}
      className="flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--bd)] px-2 py-1 text-[12px]"
    >
      {statusAvailable && s.status !== null && (
        <StatusIcon status={s.status} turnCompleted={s.turnCompleted} size={SIZE.sm} />
      )}
      <span className={cn('min-w-0 flex-1 truncate', !open && 'text-[var(--mu)]')}>
        {s.title ?? t('board:sessions.untitled')}
      </span>
      {!open && (
        <span
          data-testid={T.drawerSessionEnded}
          className="rounded-[var(--radius-chip)] border border-[var(--bd)] px-1.5 text-[11px] text-[var(--fa)] leading-4"
        >
          {t('board:sessions.ended')}
        </span>
      )}
      <span className="text-[11px] text-[var(--mu)]">{profileLabel(t, s)}</span>
      <Hint text={hintKey ? t(hintKey) : undefined}>
        <Button
          data-testid={T.gotoSession}
          variant={VARIANT.ghost}
          size={SIZE.xs}
          disabled={!open}
          onClick={() => runNavigation(goToSession(s.worktreeId, s.sessionId), GONE_NOTICE.sessionKey)}
        >
          {t('board:sessions.goto')}
        </Button>
      </Hint>
      <Button
        data-testid={T.unlinkSession}
        variant={VARIANT.ghost}
        size={SIZE.xs}
        onClick={() => runAction(boardActions.unlinkSession(task.id, s.sessionId))}
      >
        {t('board:sessions.unlink')}
      </Button>
    </div>
  )
}

/** The task's agent sessions: status (when agent-status is enabled), Go to agent, Unlink. */
export function LinkedSessions({ task }: { task: TaskDto }) {
  const t = useT()
  const worktrees = useWorktrees()
  return (
    <section className="flex flex-col gap-1.5">
      <SectionTitle>{t('board:sessions.title')}</SectionTitle>
      {task.sessions.length === 0 && <span className="text-[12px] text-[var(--fa)]">{t('board:sessions.empty')}</span>}
      {task.sessions.map((s) => (
        <SessionRow key={s.sessionId} task={task} s={s} worktrees={worktrees} />
      ))}
    </section>
  )
}
