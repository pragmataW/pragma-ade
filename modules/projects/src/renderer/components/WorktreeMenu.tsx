import { useT } from '@pragma/sdk/renderer'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { PROJECTS_DATA_ATTRS as A, PROJECTS_TESTIDS as T, type Worktree } from '../../contract'
import { moveToFolder, openNewFolder } from '../lib/folder-actions'
import { folderOf } from '../lib/folders'
import { useProjects, useRuntime } from '../lib/runtime'
import { selectFoldersOf } from '../store'
import { RowMenu } from './RowMenu'

/** "Move to folder ▸": the other folders, "New folder…", and "Remove from folder" when in one. */
function MoveToFolderMenu({ worktree }: { worktree: Worktree }) {
  const t = useT()
  const runtime = useRuntime()
  const folders = useProjects((s) => selectFoldersOf(s, worktree.projectId))
  const current = folderOf(folders, worktree.id)
  const targets = folders.filter((f) => f.id !== current?.id)
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-testid={T.moveToFolder}>{t('projects:folders.moveToFolder')}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {targets.map((f) => (
          <DropdownMenuItem
            key={f.id}
            data-testid={T.moveToFolderTarget}
            {...{ [A.folderName]: f.name }}
            onSelect={() => void moveToFolder(runtime, worktree.id, f.id)}
          >
            {f.name}
          </DropdownMenuItem>
        ))}
        {targets.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          data-testid={T.moveToNewFolder}
          onSelect={() => openNewFolder(runtime, worktree.projectId, worktree.id)}
        >
          {t('projects:folders.newFolder')}
        </DropdownMenuItem>
        {current && (
          <DropdownMenuItem
            data-testid={T.removeFromFolder}
            onSelect={() => void moveToFolder(runtime, worktree.id, null)}
          >
            {t('projects:folders.removeFromFolder')}
          </DropdownMenuItem>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** Row actions: move to a folder; remove (not for the main checkout, which cannot be removed). */
export function WorktreeMenu({ worktree }: { worktree: Worktree }) {
  const t = useT()
  const runtime = useRuntime()
  return (
    <RowMenu label={t('projects:sidebar.worktreeMenu')} testId={T.worktreeMenu}>
      <MoveToFolderMenu worktree={worktree} />
      {!worktree.isMain && (
        <DropdownMenuItem
          data-testid={T.worktreeRemove}
          onSelect={() => runtime.ui.setState({ removeFor: worktree.id })}
        >
          {t('projects:sidebar.removeWorktree')}
        </DropdownMenuItem>
      )}
    </RowMenu>
  )
}
