import { useT } from '@pragma/sdk/renderer'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { profileLabel } from '../lib/labels'
import { SectionTitle } from './SectionTitle'

const ACTIVITY_KINDS = ['created', 'session', 'updated'] as const

interface ActivityEntry {
  /** React key: the kind, or the session id. */
  id: string
  kind: ActivityKind
  at: number
  text: string
}

type ActivityKind = (typeof ACTIVITY_KINDS)[number]

/** One entry of a task-level kind (created/updated: the kind is its key). */
const taskEntry = (t: ReturnType<typeof useT>, kind: Exclude<ActivityKind, 'session'>, at: number): ActivityEntry => ({
  id: kind,
  kind,
  at,
  text: t(`board:activity.${kind}`, { date: new Date(at) }),
})

/** The task's history from what the board stores: created, each agent session started, last update; oldest first. */
function entries(t: ReturnType<typeof useT>, task: TaskDto): ActivityEntry[] {
  const sessions = task.sessions.map(
    (s): ActivityEntry => ({
      id: s.sessionId,
      kind: 'session',
      at: s.startedAt,
      text: t('board:activity.sessionStarted', { agent: profileLabel(t, s), date: new Date(s.startedAt) }),
    }),
  )
  return [taskEntry(t, 'created', task.createdAt), ...sessions, taskEntry(t, 'updated', task.updatedAt)].sort(
    (a, b) => a.at - b.at,
  )
}

/** ui-notes drawer "activity" (dates follow the UI language through i18next's `datetime` formatter). */
export function Activity({ task }: { task: TaskDto }) {
  const t = useT()
  return (
    <section data-testid={T.drawerActivity} className="flex flex-col gap-1">
      <SectionTitle>{t('board:activity.title')}</SectionTitle>
      <ol className="flex flex-col gap-0.5 text-[11px] text-[var(--fa)]">
        {entries(t, task).map((e) => (
          <li key={e.id} {...{ [A.activityKind]: e.kind }}>
            {e.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
