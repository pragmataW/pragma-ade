import { useT } from '@pragma/sdk/renderer'
import { DropdownMenuItem } from '@pragma/ui/components/dropdown-menu'
import { projectsIpc, PROJECTS_TESTIDS as T, type WorktreeFolder } from '../../contract'
import { sidebarAction } from '../lib/actions'
import { openRenameFolder } from '../lib/folder-actions'
import { useRuntime } from '../lib/runtime'
import { RowMenu } from './RowMenu'

/** Folder actions: rename, delete (its worktrees go back to the project root; none is removed). */
export function FolderMenu({ projectId, folder }: { projectId: string; folder: WorktreeFolder }) {
  const t = useT()
  const runtime = useRuntime()
  return (
    <RowMenu label={t('projects:folders.menu')} testId={T.folderMenu}>
      <DropdownMenuItem data-testid={T.folderRename} onSelect={() => openRenameFolder(runtime, projectId, folder)}>
        {t('projects:folders.rename')}
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid={T.folderDelete}
        onSelect={() => void sidebarAction(runtime, projectsIpc.deleteFolder, { projectId, folderId: folder.id })}
      >
        {t('projects:folders.delete')}
      </DropdownMenuItem>
    </RowMenu>
  )
}
