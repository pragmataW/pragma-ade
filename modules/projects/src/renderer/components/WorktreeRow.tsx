import { Slot, useT } from '@pragma/sdk/renderer'
import { cva } from 'class-variance-authority'
import {
  PROJECTS_DATA_ATTRS as A,
  projectsIpc,
  PROJECTS_SLOTS as S,
  PROJECTS_TESTIDS as T,
  type Worktree,
  type WorktreeRowSlotProps,
} from '../../contract'
import { sidebarAction } from '../lib/actions'
import { useProjects, useRuntime } from '../lib/runtime'
import { PlainButton } from './PlainButton'
import { WorktreeMenu } from './WorktreeMenu'

/**
 * ui-notes: 2-line ~40px row (px, not rem: the root font is 13px), content indented 22px past the project
 * name (`ProjectGroup` puts the name at 22px); selected = hover bg + a straight 2px accent bar on the left.
 */
const rowVariants = cva('group relative flex h-[40px] items-center rounded-[var(--radius-button)] pr-1 hover:bg-hv', {
  variants: {
    active: {
      true: "bg-hv before:absolute before:inset-y-[6px] before:left-0 before:w-[2px] before:bg-[var(--ac)] before:content-['']",
      false: '',
    },
  },
})

export function WorktreeRow({ worktree }: { worktree: Worktree }) {
  const t = useT()
  const runtime = useRuntime()
  const active = useProjects((s) => s.activeWorktreeId === worktree.id)
  const props: WorktreeRowSlotProps = { worktreeId: worktree.id, projectId: worktree.projectId, isActive: active }
  const attrs = {
    [A.branch]: worktree.branch ?? '',
    [A.main]: String(worktree.isMain),
    [A.active]: String(active),
  }
  const select = () => void sidebarAction(runtime, projectsIpc.selectWorktree, { worktreeId: worktree.id })
  return (
    <div data-testid={T.worktreeRow} {...attrs} className={rowVariants({ active })}>
      <PlainButton
        onClick={select}
        className="flex h-full min-w-0 flex-1 flex-col justify-center gap-[2px] pl-[44px] text-left"
      >
        <span className="flex w-full items-center gap-1.5">
          <Slot id={S.worktreeRowLeading} props={props} />
          <span className="truncate [font-family:var(--font-code)] text-[12px]">
            {worktree.branch ?? t('projects:sidebar.detached')}
          </span>
          <span className="flex-1" />
          <Slot id={S.worktreeRowBadges} props={props} />
        </span>
        <span className="w-full truncate text-[11px] text-mu">
          <Slot
            id={S.worktreeRowSubtitle}
            props={props}
            single
            fallback={
              worktree.isMain
                ? t('projects:sidebar.mainCheckout')
                : t('projects:sidebar.fromBase', { base: worktree.baseBranch })
            }
          />
        </span>
      </PlainButton>
      <WorktreeMenu worktree={worktree} />
    </div>
  )
}
