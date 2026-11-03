import { useT } from '@pragma/sdk/renderer'
import { DropdownMenuItem } from '@pragma/ui/components/dropdown-menu'
import { type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { sidebarAction } from '../lib/actions'
import { openNewFolder } from '../lib/folder-actions'
import { useRuntime } from '../lib/runtime'
import { RowMenu } from './RowMenu'

/** Project actions: new worktree, new folder, remove from the list (the disk is untouched). */
export function ProjectMenu({ project }: { project: Project }) {
  const t = useT()
  const runtime = useRuntime()
  return (
    <RowMenu label={t('projects:sidebar.projectMenu')} testId={T.projectMenu}>
      <DropdownMenuItem onSelect={() => runtime.ui.setState({ createFor: project.id })}>
        {t('projects:sidebar.newWorktree')}
      </DropdownMenuItem>
      <DropdownMenuItem data-testid={T.projectNewFolder} onSelect={() => openNewFolder(runtime, project.id)}>
        {t('projects:folders.newFolder')}
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid={T.projectRemove}
        onSelect={() => void sidebarAction(runtime, projectsIpc.removeProject, { projectId: project.id })}
      >
        {t('projects:sidebar.removeProject')}
      </DropdownMenuItem>
    </RowMenu>
  )
}
