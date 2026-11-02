import { basename } from 'node:path'
import { type DiffRefs, type EditorOpenDiffMsg, GIT_HEAD_REF } from '@pragma/module-editor/contract'
import { DIFF_TITLE, SCM_CHANGE } from '../constants'
import type { VscodeApi } from '../vscodeApi'
import { resolveInside } from './openFile'

const FULL_SHA_RE = /^[0-9a-f]{40}$/

const shortRef = (ref: string): string => (FULL_SHA_RE.test(ref) ? ref.slice(0, DIFF_TITLE.shaLength) : ref)

/** `app.ts (abc1234 ↔ HEAD)`. */
export const diffTitle = (path: string, oldLabel: string, newLabel: string): string =>
  `${basename(path)}${DIFF_TITLE.open}${shortRef(oldLabel)}${DIFF_TITLE.separator}${shortRef(newLabel)}${DIFF_TITLE.close}`

const refsDiff = (api: VscodeApi, oldAbs: string, abs: string, path: string, refs: DiffRefs) =>
  api.openRevisionDiff(
    { path: oldAbs, ref: refs.old },
    { path: abs, ref: refs.new },
    diffTitle(path, refs.old, refs.new),
  )

/** The SCM change; a file git does not list (e.g. untracked in a separate group) gets HEAD ↔ the file on disk. */
async function uncommittedDiff(api: VscodeApi, oldAbs: string, abs: string, path: string): Promise<boolean> {
  const scm = await api.openScmChange(abs)
  if (scm === SCM_CHANGE.opened) return true
  if (scm === SCM_CHANGE.noRepository) return false
  return api.openRevisionDiff(
    { path: oldAbs, ref: GIT_HEAD_REF },
    { path: abs, ref: null },
    diffTitle(path, GIT_HEAD_REF, DIFF_TITLE.workingTree),
  )
}

/**
 * `editor.openDiff`: VS Code's own git diff of the file (the user goes to the plain file with VS Code's "Open File").
 * Without `refs` the uncommitted change (`git.openChange`); with `refs` `old` ↔ `new` as `git:` URIs. Without a git
 * repository (git extension disabled) the plain file opens instead.
 */
export async function handleOpenDiff(api: VscodeApi, folderPath: string, m: EditorOpenDiffMsg): Promise<void> {
  const abs = resolveInside(api, folderPath, m.path)
  const oldAbs = m.oldPath === undefined ? abs : resolveInside(api, folderPath, m.oldPath)
  if (!abs || !oldAbs) return
  const opened = m.refs
    ? await refsDiff(api, oldAbs, abs, m.path, m.refs)
    : await uncommittedDiff(api, oldAbs, abs, m.path)
  if (!opened) await api.openAndReveal(abs, m.line)
  else if (m.line) api.revealInActiveEditor(m.line)
}
