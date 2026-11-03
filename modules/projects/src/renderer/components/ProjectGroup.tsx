import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cva } from 'class-variance-authority'
import { useMemo, useState } from 'react'
import { ICON_PX, ICONS } from '../../constants'
import { PROJECTS_DATA_ATTRS as A, type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { sidebarAction } from '../lib/actions'
import { useWorktreeDrop } from '../lib/folder-actions'
import { groupByFolder } from '../lib/folders'
import { MOTION_CLASSES as MOTION } from '../lib/motion'
import { useProjects, useRuntime } from '../lib/runtime'
import { useErrorText } from '../lib/use-error-text'
import { filterWorktrees, selectFoldersOf } from '../store'
import { FolderNode } from './FolderNode'
import { PlainButton } from './PlainButton'
import { ProjectMenu } from './ProjectMenu'
import { WorktreeRow } from './WorktreeRow'

/** The project's root drop zone (header, root rows, the area below): accent ring and tint while a row is over it. */
const rootZoneVariants = cva(`rounded-[var(--radius-button)] transition-[box-shadow,background-color] ${MOTION}`, {
  variants: {
    over: { true: 'bg-[color-mix(in_srgb,var(--ac)_8%,transparent)] ring-1 ring-[var(--ac)]', false: '' },
  },
})

function NewWorktreeRow({ projectId }: { projectId: string }) {
  const t = useT()
  const runtime = useRuntime()
  return (
    <PlainButton
      data-testid={T.projectNewWorktree}
      onClick={() => runtime.ui.setState({ createFor: projectId })}
      className="flex h-[var(--row-h)] w-full items-center gap-1.5 rounded-[var(--radius-button)] pl-[44px] text-left text-mu text-[12px] hover:bg-hv hover:text-tx"
    >
      <Icon name={ICONS.add} size={ICON_PX.small} />
      {t('projects:sidebar.newWorktree')}
    </PlainButton>
  )
}

/** The project's folders and root worktrees after the filter; with a query, folders without matches drop out. */
function useProjectTree(project: Project, query: string) {
  const all = useProjects((s) => s.worktrees)
  const folders = useProjects((s) => selectFoldersOf(s, project.id))
  return useMemo(() => {
    const tree = groupByFolder(
      all.filter((w) => w.projectId === project.id),
      folders,
    )
    const filtering = query.trim() !== ''
    const views = tree.folders
      .map((view) => ({ view, shown: filterWorktrees(project, view.worktrees, query) }))
      .filter((f) => !filtering || f.shown.length > 0)
    const root = filterWorktrees(project, tree.root, query)
    return { filtering, views, root, empty: root.length === 0 && views.length === 0 }
  }, [all, folders, project, query])
}

/** Folders first, then the worktrees at the root. */
function WorktreeTree({ project, query }: { project: Project; query: string }) {
  const { filtering, views, root } = useProjectTree(project, query)
  return (
    <div role="tree" aria-label={project.name} data-testid={T.worktreeTree} className="flex flex-col">
      {views.map(({ view, shown }) => (
        <FolderNode key={view.folder.id} projectId={project.id} view={view} shown={shown} filtering={filtering} />
      ))}
      {root.map((w) => (
        <WorktreeRow key={w.id} worktree={w} />
      ))}
    </div>
  )
}

/**
 * A collapsible, sortable project with its folders and worktrees; clicking the header also re-syncs from
 * git. With a filter `query`, only matching worktrees show and a project without matches is hidden.
 * The whole group outside its folders is the root drop zone: a row dropped there leaves its folder.
 */
export function ProjectGroup({ project, query }: { project: Project; query: string }) {
  const runtime = useRuntime()
  const [collapsed, setCollapsed] = useState(false)
  const { filtering, empty } = useProjectTree(project, query)
  const drop = useWorktreeDrop(project.id, null)
  const error = useProjects((s) => s.projectErrors[project.id])
  const errorText = useErrorText()
  const sortable = useSortable({ id: project.id })
  const toggle = () => {
    setCollapsed((c) => !c)
    void sidebarAction(runtime, projectsIpc.syncProject, { projectId: project.id })
  }
  if (filtering && empty) return null
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      data-testid={T.projectGroup}
      {...{ [A.projectName]: project.name, [A.dropTarget]: String(drop.over) }}
      {...drop.props}
      className={rootZoneVariants({ over: drop.over })}
    >
      <div className="group flex h-[var(--row-h)] items-center gap-1 rounded-[var(--radius-button)] pr-1 hover:bg-hv">
        <PlainButton
          data-testid={T.projectHeader}
          {...sortable.attributes}
          {...sortable.listeners}
          aria-expanded={!collapsed}
          onClick={toggle}
          className="flex h-full min-w-0 flex-1 items-center gap-[4px] pl-[4px] text-left font-medium"
        >
          <Icon name={collapsed ? ICONS.collapsed : ICONS.expanded} size={ICON_PX.row} className="text-mu" />
          <span className="truncate">{project.name}</span>
        </PlainButton>
        <ProjectMenu project={project} />
      </div>
      {error && <p className="pl-[22px] text-err text-[12px]">{errorText({ code: error })}</p>}
      {!collapsed && (
        <>
          <WorktreeTree project={project} query={query} />
          {!filtering && <NewWorktreeRow projectId={project.id} />}
        </>
      )}
    </div>
  )
}
