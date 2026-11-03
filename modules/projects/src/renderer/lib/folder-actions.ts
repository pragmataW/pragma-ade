import { type DragEvent, useState } from 'react'
import { DROP_EFFECT_MOVE, WORKTREE_DRAG_TYPE } from '../../constants'
import { projectsIpc, type WorktreeFolder } from '../../contract'
import { selectFoldersOf } from '../store'
import { sidebarAction } from './actions'
import { folderOf } from './folders'
import { type ProjectsRuntime, useRuntime } from './runtime'

/** Opens the folder-name dialog to create a folder (moving `worktreeId` into it when given). */
export const openNewFolder = (runtime: ProjectsRuntime, projectId: string, worktreeId: string | null = null): void =>
  runtime.ui.setState({ folderDialog: { projectId, folderId: null, name: '', worktreeId } })

export const openRenameFolder = (runtime: ProjectsRuntime, projectId: string, folder: WorktreeFolder): void =>
  runtime.ui.setState({ folderDialog: { projectId, folderId: folder.id, name: folder.name, worktreeId: null } })

/** Into `folderId`, or back to the project root with null. */
export const moveToFolder = (runtime: ProjectsRuntime, worktreeId: string, folderId: string | null): Promise<void> =>
  sidebarAction(runtime, projectsIpc.moveWorktreeToFolder, { worktreeId, folderId })

/** Native drag source props of a worktree row. */
export function worktreeDragProps(worktreeId: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(WORKTREE_DRAG_TYPE, worktreeId)
      e.dataTransfer.effectAllowed = DROP_EFFECT_MOVE
    },
  }
}

const carriesWorktree = (e: DragEvent): boolean => Array.from(e.dataTransfer.types).includes(WORKTREE_DRAG_TYPE)

/**
 * Drop target for worktree rows of `projectId`: into `folderId`, or the project root with null. The
 * innermost target wins (a folder inside the root zone): the capture phase clears `over`, the bubble
 * phase of the handling target sets it again.
 */
export function useWorktreeDrop(projectId: string, folderId: string | null) {
  const runtime = useRuntime()
  const [over, setOver] = useState(false)
  const drop = (worktreeId: string): void => {
    const s = runtime.store.getState()
    const w = s.worktrees.find((x) => x.id === worktreeId)
    if (!w || w.projectId !== projectId) return
    if ((folderOf(selectFoldersOf(s, projectId), worktreeId)?.id ?? null) === folderId) return
    void moveToFolder(runtime, worktreeId, folderId)
  }
  const props = {
    onDragOverCapture: () => setOver(false),
    onDragOver: (e: DragEvent) => {
      if (!carriesWorktree(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = DROP_EFFECT_MOVE
      setOver(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      if (!carriesWorktree(e)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(false)
      drop(e.dataTransfer.getData(WORKTREE_DRAG_TYPE))
    },
  }
  return { over, props }
}
