import { EDITOR_OPEN_DIFF_COMMAND, FILES_TAB_ID, HEAD_REF } from '../../constants'
import { CHANGE_MODE, type ChangedFile, type ChangeMode } from '../../contract'
import { getRendererCtx } from './sdk'

/** Which diff "Open in editor" asks for: the uncommitted change, or merge-base ↔ HEAD in branch mode. */
export interface DiffTarget {
  worktreeId: string
  mode: ChangeMode
  mergeBase: string | null
}

/** `editor.openDiff` arguments (06's `OpenDiffArgs`, built here: git-changes does not depend on the editor module). */
export function openDiffArgs(target: DiffTarget, file: ChangedFile, line?: number) {
  const refs = target.mode === CHANGE_MODE.branch && target.mergeBase ? { old: target.mergeBase, new: HEAD_REF } : null
  return {
    worktreeId: target.worktreeId,
    path: file.path,
    ...(file.oldPath ? { oldPath: file.oldPath } : {}),
    ...(refs ? { refs } : {}),
    ...(line ? { line } : {}),
  }
}

export type EditorOpener = (file: ChangedFile, line?: number) => void

/** Opens the file's git diff in the Files tab; null when no editor module registered `editor.openDiff`. */
export function editorOpener(target: DiffTarget): EditorOpener | null {
  const ctx = getRendererCtx()
  if (!ctx.commands.has(EDITOR_OPEN_DIFF_COMMAND)) return null
  return (file, line) => {
    void ctx.commands
      .execute(EDITOR_OPEN_DIFF_COMMAND, openDiffArgs(target, file, line))
      .then(() => ctx.panels.activateRightTab(FILES_TAB_ID))
      .catch((e: unknown) => console.warn('git-changes: open in editor failed', e))
  }
}
