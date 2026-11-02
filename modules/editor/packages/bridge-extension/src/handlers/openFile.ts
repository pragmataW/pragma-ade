import { isAbsolute, resolve } from 'node:path'
import { type EditorOpenFileMsg, normalizeFolderKey, PATH_SEP } from '@pragma/module-editor/contract'
import { OUTSIDE_FOLDER_WARNING } from '../constants'
import type { VscodeApi } from '../vscodeApi'

/** True when `abs` is the folder itself or below it (case rules of `normalizeFolderKey`). */
export function isInsideFolder(folderPath: string, abs: string): boolean {
  const folder = normalizeFolderKey(folderPath)
  const file = normalizeFolderKey(abs)
  return file === folder || file.startsWith(`${folder}${PATH_SEP}`)
}

/** `editor.openFile`: relative paths are worktree-relative; absolute paths outside the folder are refused. */
export async function handleOpenFile(api: VscodeApi, folderPath: string, m: EditorOpenFileMsg): Promise<void> {
  const abs = isAbsolute(m.path) ? m.path : resolve(folderPath, m.path)
  if (!isInsideFolder(folderPath, abs)) {
    api.showWarning(`${OUTSIDE_FOLDER_WARNING}${m.path}`)
    return
  }
  await api.openAndReveal(abs, m.line, m.column)
}
