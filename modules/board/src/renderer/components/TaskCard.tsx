import { Slot, useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Monogram } from '@pragma/ui/components/monogram'
import { MONOGRAM_PX } from '../../constants'
import {
  BOARD_TESTID_ATTRS as A,
  BOARD_CARD_BADGES_SLOT,
  type BoardCardBadgesProps,
  type BoardSection,
  BOARD_TESTIDS as T,
  type TaskDto,
} from '../../contract'
import { monogram, profileLabel } from '../lib/labels'
import { useWorktrees } from '../lib/use-worktrees'
import { LabelChip } from './LabelChip'
import { PlainButton } from './PlainButton'
import { PriorityBars } from './PriorityBars'

function WorktreeChip({ worktreeId }: { worktreeId: string | null }) {
  const t = useT()
  const worktree = useWorktrees().get(worktreeId ?? '')
  if (!worktreeId)
    return (
      <span data-testid={T.cardNoWorktree} className="text-[11px] text-[var(--fa)]">
        {t('board:card.noWorktree')}
      </span>
    )
  return (
    <span
      data-testid={T.cardWorktree}
      {...{ [A.worktreeId]: worktreeId }}
      className="truncate font-mono text-[11px] text-[var(--mu)]"
    >
      {worktree?.branch ?? t('board:worktree.detached')}
    </span>
  )
}

function SessionMarks({ task }: { task: TaskDto }) {
  const t = useT()
  return (
    <span className="flex items-center gap-1">
      {task.sessions.map((s) => (
        <span
          key={s.sessionId}
          data-testid={T.cardSession}
          {...{ [A.sessionId]: s.sessionId }}
          title={profileLabel(t, s)}
        >
          <Monogram letters={monogram(profileLabel(t, s))} size={MONOGRAM_PX} />
        </span>
      ))}
      <span data-testid={T.cardBadges} className="flex items-center">
        <Slot<BoardCardBadgesProps>
          id={BOARD_CARD_BADGES_SLOT}
          props={{ taskId: task.id, sessionIds: task.sessionIds }}
        />
      </span>
    </span>
  )
}

/** Card (ui-notes Screen 5): key · priority · title · labels · worktree · agent marks + status slot. */
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
          <span data-testid={T.cardProject} className="ml-auto truncate text-[11px] text-[var(--mu)]">
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
        <WorktreeChip worktreeId={task.worktreeId} />
        <SessionMarks task={task} />
      </div>
    </article>
  )
}
