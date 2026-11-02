import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import {
  Archive,
  ArchiveRestore,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
  Trash2,
} from '@pragma/ui/icons'
import { useState } from 'react'
import { BUTTON_TYPE, ROW_ACTION_ICON_PX, TREE_ICON_PX } from '../../constants'
import { STASH_ACTIONS, type StashAction, type StashEntry, GitChangesTestIds as T } from '../../contract'
import { type StashFile, useGitChangesStore } from '../store'
import type { ScmActions } from './actions'
import { useStashFiles } from './use-scm'

const [APPLY, POP, DROP] = STASH_ACTIONS
const STASH_BUTTONS: [StashAction, LucideIcon][] = [
  [APPLY, ArchiveRestore],
  [POP, ArrowUpFromLine],
  [DROP, Trash2],
]

interface RowProps {
  worktreeId: string
  entry: StashEntry
  expanded: boolean
  selected: StashFile | null
  actions: ScmActions
  onToggle(): void
}

function StashRow({ worktreeId, entry, expanded, selected, actions, onToggle }: RowProps) {
  const t = useT()
  const files = useStashFiles(worktreeId, expanded ? entry.sha : null)
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <>
      <div
        data-testid={T.stashRow}
        data-sha={entry.sha}
        className="group flex h-[22px] items-center gap-1 pr-2 pl-1 text-[13px] hover:bg-[var(--hv)]"
      >
        <button
          type={BUTTON_TYPE}
          aria-expanded={expanded}
          onClick={onToggle}
          title={entry.message}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <Chevron size={TREE_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
          <Archive size={TREE_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{entry.message}</span>
        </button>
        <span className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">
          {STASH_BUTTONS.map(([action, Icon]) => (
            <button
              key={action}
              type={BUTTON_TYPE}
              data-testid={T.stashAction(action)}
              aria-label={t(`git-changes:scm.stash.${action}`)}
              title={t(`git-changes:scm.stash.${action}`)}
              onClick={() => void actions.stash(action, entry)}
              className="flex size-[18px] items-center justify-center rounded text-muted-foreground hover:bg-[var(--bd)] hover:text-[var(--tx)]"
            >
              <Icon size={ROW_ACTION_ICON_PX} aria-hidden />
            </button>
          ))}
        </span>
      </div>
      {expanded
        ? files?.map((file) => {
            const isSelected = selected?.sha === entry.sha && selected.file.path === file.path
            return (
              <button
                key={file.path}
                type={BUTTON_TYPE}
                data-testid={T.stashFile}
                data-path={file.path}
                data-selected={isSelected || undefined}
                onClick={() => useGitChangesStore.getState().showStashFile(worktreeId, { sha: entry.sha, file })}
                title={file.path}
                className={cn(
                  'flex h-[22px] w-full items-center gap-1 pr-2 pl-[38px] text-left text-[13px]',
                  isSelected ? 'bg-[var(--hv)]' : 'hover:bg-[var(--hv)]',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{file.path}</span>
                <span
                  className={cn(
                    'w-3 shrink-0 text-center font-mono font-semibold text-[11px]',
                    `gc-status-${file.status}`,
                  )}
                >
                  {t(`git-changes:status.letter.${file.status}`)}
                </span>
              </button>
            )
          })
        : null}
    </>
  )
}

/** VS Code's Stashes view: newest first; a row expands to its files (click one to diff it); Apply / Pop / Drop. */
export function StashList(props: {
  worktreeId: string
  stashes: readonly StashEntry[]
  selected: StashFile | null
  actions: ScmActions
}) {
  const t = useT()
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  if (props.stashes.length === 0) return null
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <section data-testid={T.stashes} className="flex max-h-[40%] shrink-0 flex-col border-[var(--bd)] border-t">
      <button
        type={BUTTON_TYPE}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[22px] shrink-0 items-center gap-1 px-1 text-left"
      >
        <Chevron size={TREE_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
          {t('git-changes:scm.stash.title')}
        </span>
        <span className="shrink-0 rounded-full bg-[var(--hv)] px-1.5 text-[11px] text-muted-foreground">
          {props.stashes.length}
        </span>
      </button>
      {open ? (
        <div className="min-h-0 overflow-auto">
          {props.stashes.map((entry) => (
            <StashRow
              key={entry.sha}
              worktreeId={props.worktreeId}
              entry={entry}
              expanded={expanded === entry.sha}
              selected={props.selected}
              actions={props.actions}
              onToggle={() => setExpanded(expanded === entry.sha ? null : entry.sha)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
