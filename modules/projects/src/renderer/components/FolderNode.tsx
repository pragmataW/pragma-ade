import { Slot, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cva } from 'class-variance-authority'
import { type KeyboardEvent, useRef } from 'react'
import { ICON_PX, ICONS, TREE_KEYS as K, TREE_LEVEL } from '../../constants'
import {
  PROJECTS_DATA_ATTRS as A,
  projectsIpc,
  PROJECTS_SLOTS as S,
  PROJECTS_TESTIDS as T,
  type Worktree,
  type WorktreeFolderSlotProps,
} from '../../contract'
import { sidebarAction } from '../lib/actions'
import { openRenameFolder, useWorktreeDrop } from '../lib/folder-actions'
import type { FolderView } from '../lib/folders'
import { MOTION_CLASSES as MOTION } from '../lib/motion'
import { useProjects, useRuntime } from '../lib/runtime'
import { FolderMenu } from './FolderMenu'
import { PlainButton } from './PlainButton'
import { TreeItem } from './TreeItem'
import { WorktreeRow } from './WorktreeRow'

/** Expand/collapse: the children grid row animates between 0fr and 1fr (no measured heights). */
const childrenVariants = cva(`grid transition-[grid-template-rows] ${MOTION}`, {
  variants: { open: { true: 'grid-rows-[1fr]', false: 'grid-rows-[0fr]' } },
})
const chevronVariants = cva(`shrink-0 text-mu transition-transform ${MOTION}`, {
  variants: { open: { true: 'rotate-90', false: '' } },
})
const headerVariants = cva(
  'group flex h-[var(--row-h)] items-center gap-1 rounded-[var(--radius-button)] pr-1 hover:bg-hv group-focus-visible/folder:ring-1 group-focus-visible/folder:ring-[var(--ac)]',
  { variants: { over: { true: 'bg-hv ring-1 ring-[var(--ac)]', false: '' } } },
)

/** Enter/Space toggle, →/← expand/collapse, F2 rename — only for keys aimed at the folder item itself. */
function useFolderKeys(on: { toggle(): void; expand(): void; collapse(): void; rename(): void }) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    const keys: Partial<Record<string, () => void>> = {
      [K.enter]: on.toggle,
      [K.space]: on.toggle,
      [K.expand]: on.expand,
      [K.collapse]: on.collapse,
      [K.rename]: on.rename,
    }
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }
}

/** Aggregated agent status (the folder slot); without entries, each member's `worktreeRow.leading`. */
function FolderStatus(props: WorktreeFolderSlotProps) {
  const activeId = useProjects((s) => s.activeWorktreeId)
  const members = props.worktreeIds.map((worktreeId) => (
    <Slot
      key={worktreeId}
      id={S.worktreeRowLeading}
      props={{ worktreeId, projectId: props.projectId, isActive: worktreeId === activeId }}
    />
  ))
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <Slot id={S.worktreeFolderLeading} props={props} fallback={members} />
    </span>
  )
}

/**
 * A sidebar folder (WAI-ARIA `treeitem`): header with name, count and, while collapsed, the members'
 * status; drop worktree rows on it to move them in. A filter keeps it open.
 */
export function FolderNode({
  projectId,
  view,
  shown,
  filtering,
}: {
  projectId: string
  view: FolderView
  shown: Worktree[]
  filtering: boolean
}) {
  const t = useT()
  const runtime = useRuntime()
  const item = useRef<HTMLDivElement>(null)
  const { folder } = view
  const open = filtering || !folder.collapsed
  const drop = useWorktreeDrop(projectId, folder.id)
  const setCollapsed = (collapsed: boolean) => {
    if (collapsed === folder.collapsed) return
    void sidebarAction(runtime, projectsIpc.setFolderCollapsed, { projectId, folderId: folder.id, collapsed })
  }
  const toggle = () => setCollapsed(!folder.collapsed)
  const onKeyDown = useFolderKeys({
    toggle,
    expand: () => setCollapsed(false),
    collapse: () => setCollapsed(true),
    rename: () => openRenameFolder(runtime, projectId, folder),
  })
  const count = view.worktrees.length
  return (
    <TreeItem
      ref={item}
      level={TREE_LEVEL.root}
      aria-expanded={open}
      aria-label={t('projects:folders.label', { name: folder.name, count })}
      tabIndex={0}
      data-testid={T.folder}
      {...{ [A.folderId]: folder.id, [A.folderName]: folder.name }}
      onKeyDown={onKeyDown}
      {...drop.props}
      className="group/folder outline-none"
    >
      <div className={headerVariants({ over: drop.over })}>
        <PlainButton
          tabIndex={-1}
          data-testid={T.folderHeader}
          onClick={() => {
            toggle()
            item.current?.focus()
          }}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-[22px] text-left"
        >
          <Icon name={ICONS.collapsed} size={ICON_PX.small} className={chevronVariants({ open })} />
          <Icon name={open ? ICONS.folderOpen : ICONS.folder} size={ICON_PX.row} className="shrink-0 text-mu" />
          <span className="truncate">{folder.name}</span>
          <span data-testid={T.folderCount} aria-hidden className="text-[11px] text-mu">
            {count}
          </span>
          <span className="flex-1" />
          {!open && (
            <FolderStatus projectId={projectId} folderId={folder.id} worktreeIds={view.worktrees.map((w) => w.id)} />
          )}
        </PlainButton>
        <FolderMenu projectId={projectId} folder={folder} />
      </div>
      <div className={childrenVariants({ open })}>
        {/* biome-ignore lint/a11y/useSemanticElements: the children group of a WAI-ARIA tree item, not a form fieldset */}
        <div role="group" inert={!open} className="min-h-0 overflow-hidden">
          {shown.map((w) => (
            <WorktreeRow key={w.id} worktree={w} level={TREE_LEVEL.inFolder} />
          ))}
        </div>
      </div>
    </TreeItem>
  )
}
