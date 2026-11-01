import { useT } from '@pragma/sdk/renderer'
import { PROJECTS_TESTIDS as T } from '../../contract'
import { useProjects } from '../lib/runtime'
import { selectActiveWorktree } from '../store'

/** `titlebar.left`: `project › branch` of the active worktree, branch in mono (nothing when none is active). */
export function Breadcrumb() {
  const t = useT()
  const active = useProjects(selectActiveWorktree)
  const project = useProjects((s) => s.projects.find((p) => p.id === active?.projectId) ?? null)
  if (!active || !project) return null
  const branch = active.branch ?? t('projects:sidebar.detached')
  return (
    <span data-testid={T.breadcrumb} className="truncate text-mu text-[12px]">
      {`${project.name} ${t('projects:breadcrumb.separator')} `}
      <span className="[font-family:var(--font-code)]">{branch}</span>
    </span>
  )
}
