import { type DragEvent, useState } from 'react'
import { DROP_EFFECT_MOVE, WORKTREE_DRAG_TYPE } from '../../constants'
import { projectsIpc, type Worktree, type WorktreeFolder } from '../../contract'
import { selectFoldersOf } from '../store'
import type { UiState } from '../ui-store'
import { sidebarAction } from './actions'
import { folderOf } from './folders'
import { type ProjectsRuntime, useRuntime, useUi } from './runtime'

/** Opens the folder-name dialog to create a folder (moving `worktreeId` into it when given). */
export const openNewFolder = (runtime: ProjectsRuntime, projectId: string, worktreeId: string | null = null): void =>
  runtime.ui.setState({ folderDialog: { projectId, folderId: null, name: '', worktreeId } })

export const openRenameFolder = (runtime: ProjectsRuntime, projectId: string, folder: WorktreeFolder): void =>
  runtime.ui.setState({ folderDialog: { projectId, folderId: folder.id, name: folder.name, worktreeId: null } })

/** Into `folderId`, or back to the project root with null. */
export const moveToFolder = (runtime: ProjectsRuntime, worktreeId: string, folderId: string | null): Promise<void> =>
  sidebarAction(runtime, projectsIpc.moveWorktreeToFolder, { worktreeId, folderId })

/** Native drag source props of a worktree row; the drag is also recorded in `ui.dragging`. */
export function useWorktreeDrag(worktree: Worktree) {
  const { ui } = useRuntime()
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(WORKTREE_DRAG_TYPE, worktree.id)
      e.dataTransfer.effectAllowed = DROP_EFFECT_MOVE
      ui.setState({ dragging: { worktreeId: worktree.id, projectId: worktree.projectId } })
    },
    onDragEnd: () => ui.setState({ dragging: null }),
  }
}

/** The worktree id of a row drag of `projectId`, or null for any other drag (foreign data, other project). */
function draggedRow(e: DragEvent, dragging: UiState['dragging'], projectId: string): string | null {
  if (!Array.from(e.dataTransfer.types).includes(WORKTREE_DRAG_TYPE)) return null
  return dragging?.projectId === projectId ? dragging.worktreeId : null
}

/**
 * Drop target for worktree rows of `projectId`: into `folderId`, or the project root with null. Rows of
 * another project are refused. The innermost target wins (a folder inside the project's root zone): the
 * capture phase clears `over`, the bubble phase of the accepting target sets it again; it also clears when
 * the drag ends anywhere.
 */
export function useWorktreeDrop(projectId: string, folderId: string | null) {
  const runtime = useRuntime()
  const [over, setOver] = useState(false)
  const dragging = useUi((s) => s.dragging)
  const accept = (e: DragEvent): string | null => {
    const id = draggedRow(e, runtime.ui.getState().dragging, projectId)
    if (id === null) return null
    e.preventDefault()
    e.stopPropagation()
    return id
  }
  const drop = (worktreeId: string): void => {
    const current = folderOf(selectFoldersOf(runtime.store.getState(), projectId), worktreeId)?.id ?? null
    if (current !== folderId) void moveToFolder(runtime, worktreeId, folderId)
  }
  const props = {
    onDragOverCapture: () => setOver(false),
    onDragOver: (e: DragEvent) => {
      if (accept(e) === null) return
      e.dataTransfer.dropEffect = DROP_EFFECT_MOVE
      setOver(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      const id = accept(e)
      if (id === null) return
      setOver(false)
      runtime.ui.setState({ dragging: null })
      drop(id)
    },
  }
  return { over: over && dragging !== null, props }
}
