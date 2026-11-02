import { ProviderIcon, Slot, useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Monogram } from '@pragma/ui/components/monogram'
import { AGENT_MARK_PX } from '../../constants'
import {
  BOARD_TESTID_ATTRS as A,
  BOARD_CARD_BADGES_SLOT,
  type BoardCardBadgesProps,
  type BoardSection,
  type LinkedSessionDto,
  BOARD_TESTIDS as T,
  type TaskDto,
} from '../../contract'
import { monogram, profileLabel } from '../lib/labels'
import { useWorktrees } from '../lib/use-worktrees'
import { LabelChip } from './LabelChip'
import { PlainButton } from './PlainButton'
import { PriorityBars } from './PriorityBars'

/** The linked sessions' most urgent status (agent-status fills the slot; empty without it). */
function StatusDot({ task }: { task: TaskDto }) {
  return (
    <span data-testid={T.cardBadges} className="flex shrink-0 items-center">
      <Slot<BoardCardBadgesProps>
        id={BOARD_CARD_BADGES_SLOT}
        props={{ taskId: task.id, sessionIds: task.sessionIds }}
      />
    </span>
  )
}

/** ui-notes: linked worktree chip (status dot + branch) or "No worktree". */
function WorktreeChip({ task }: { task: TaskDto }) {
  const t = useT()
  const worktree = useWorktrees().get(task.worktreeId ?? '')
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <StatusDot task={task} />
      {task.worktreeId ? (
        <span
          data-testid={T.cardWorktree}
          {...{ [A.worktreeId]: task.worktreeId }}
          className="truncate font-mono text-[11px] text-[var(--mu)]"
        >
          {worktree?.branch ?? t('board:worktree.detached')}
        </span>
      ) : (
        <span data-testid={T.cardNoWorktree} className="text-[11px] text-[var(--fa)]">
          {t('board:card.noWorktree')}
        </span>
      )}
    </span>
  )
}

/** The agent's official logo (SDK `ProviderIcon`, 20px on cards); a monogram when the provider is unknown. */
function AgentMark({ session }: { session: LinkedSessionDto }) {
  const t = useT()
  const label = profileLabel(t, session)
  return (
    <span data-testid={T.cardSession} {...{ [A.sessionId]: session.sessionId }} title={label} className="flex">
      {session.providerId ? (
        <ProviderIcon providerId={session.providerId} size={AGENT_MARK_PX} />
      ) : (
        <Monogram letters={monogram(label)} size={AGENT_MARK_PX} />
      )}
    </span>
  )
}

/** Card (ui-notes Screen 5): key · priority · title · labels · worktree · agent marks. */
export function TaskCard(props: {
  task: TaskDto
  section: BoardSection | undefined
  showProject: boolean
  selected: boolean
  onOpen(): void
}) {
  const { task, section, selected } = props
  const labels = section?.labels.filter((l) => task.labelIds.includes(l.id)) ?? []
  return (
    <article
      data-testid={T.card}
      {...{ [A.taskId]: task.id, [A.taskKeyAttr]: task.key, [A.selected]: selected }}
      className={cn(
        'flex flex-col gap-1.5 rounded-[var(--radius-card)] border bg-[var(--el)] p-2 text-[12.5px]',
        selected ? 'border-[var(--ac)]' : 'border-[var(--bd)] hover:border-[var(--bd2)]',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-[var(--fa)]">{task.key}</span>
        <PriorityBars priority={task.priority} />
        {props.showProject && section && (
          <span
            data-testid={T.cardProject}
            className="ml-auto max-w-[50%] truncate rounded-[var(--radius-chip)] border border-[var(--bd)] bg-[var(--pn)] px-1.5 text-[11px] text-[var(--mu)] leading-4"
          >
            {section.projectName}
          </span>
        )}
      </div>
      <PlainButton
        data-testid={T.cardTitle}
        onClick={props.onOpen}
        className="text-left text-[var(--tx)] leading-snug outline-none hover:underline focus-visible:underline"
      >
        {task.title}
      </PlainButton>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <WorktreeChip task={task} />
        <span className="flex shrink-0 items-center gap-1">
          {task.sessions.map((s) => (
            <AgentMark key={s.sessionId} session={s} />
          ))}
        </span>
      </div>
    </article>
  )
}
