import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { useMemo, useState } from 'react'
import { ICON_PX, ICONS } from '../../constants'
import { PROJECTS_DATA_ATTRS as A, type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { sidebarAction } from '../lib/actions'
import { useProjects, useRuntime } from '../lib/runtime'
import { useErrorText } from '../lib/use-error-text'
import { filterWorktrees } from '../store'
import { PlainButton } from './PlainButton'
import { ProjectMenu } from './ProjectMenu'
import { WorktreeRow } from './WorktreeRow'

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

/**
 * A collapsible, sortable project with its worktrees; clicking the header also re-syncs from git.
 * With a filter `query`, only matching worktrees show and a project without matches is hidden.
 */
export function ProjectGroup({ project, query }: { project: Project; query: string }) {
  const runtime = useRuntime()
  const [collapsed, setCollapsed] = useState(false)
  const all = useProjects((s) => s.worktrees)
  const worktrees = useMemo(
    () =>
      filterWorktrees(
        project,
        all.filter((w) => w.projectId === project.id),
        query,
      ),
    [all, project, query],
  )
  const error = useProjects((s) => s.projectErrors[project.id])
  const errorText = useErrorText()
  const sortable = useSortable({ id: project.id })
  const toggle = () => {
    setCollapsed((c) => !c)
    void sidebarAction(runtime, projectsIpc.syncProject, { projectId: project.id })
  }
  const filtering = query.trim() !== ''
  if (filtering && worktrees.length === 0) return null
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      data-testid={T.projectGroup}
      {...{ [A.projectName]: project.name }}
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
        <div className="flex flex-col">
          {worktrees.map((w) => (
            <WorktreeRow key={w.id} worktree={w} />
          ))}
          {!filtering && <NewWorktreeRow projectId={project.id} />}
        </div>
      )}
    </div>
  )
}
