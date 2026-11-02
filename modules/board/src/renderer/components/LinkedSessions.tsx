import { StatusIcon } from '@pragma/module-agent-status/renderer'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { SIZE, VARIANT } from '../../constants'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { runAction } from '../lib/actions'
import { profileLabel } from '../lib/labels'
import { goToSession } from '../lib/navigation'
import { boardActions, useBoardStore } from '../store'
import { SectionTitle } from './SectionTitle'

/** The task's agent sessions: status (when agent-status is enabled), Go to agent, Unlink. */
export function LinkedSessions({ task }: { task: TaskDto }) {
  const t = useT()
  const statusAvailable = useBoardStore((s) => s.snapshot?.statusAvailable ?? false)
  return (
    <section className="flex flex-col gap-1.5">
      <SectionTitle>{t('board:sessions.title')}</SectionTitle>
      {task.sessions.length === 0 && <span className="text-[12px] text-[var(--fa)]">{t('board:sessions.empty')}</span>}
      {task.sessions.map((s) => (
        <div
          key={s.sessionId}
          data-testid={T.drawerSession}
          {...{ [A.sessionId]: s.sessionId, [A.status]: s.status ?? undefined }}
          className="flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--bd)] px-2 py-1 text-[12px]"
        >
          {statusAvailable && s.status !== null && (
            <StatusIcon status={s.status} turnCompleted={s.turnCompleted} size={SIZE.sm} />
          )}
          <span className="min-w-0 flex-1 truncate">{s.title ?? t('board:sessions.untitled')}</span>
          <span className="text-[11px] text-[var(--mu)]">{profileLabel(t, s)}</span>
          <Button
            data-testid={T.gotoSession}
            variant={VARIANT.ghost}
            size={SIZE.xs}
            onClick={() => runAction(goToSession(s.worktreeId, s.sessionId))}
          >
            {t('board:sessions.goto')}
          </Button>
          <Button
            data-testid={T.unlinkSession}
            variant={VARIANT.ghost}
            size={SIZE.xs}
            onClick={() => runAction(boardActions.unlinkSession(task.id, s.sessionId))}
          >
            {t('board:sessions.unlink')}
          </Button>
        </div>
      ))}
    </section>
  )
}
