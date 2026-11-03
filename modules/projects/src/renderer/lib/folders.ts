import type { Worktree, WorktreeFolder } from '../../contract'

export interface FolderView {
  folder: WorktreeFolder
  /** Live members in the sidebar's worktree order. */
  worktrees: Worktree[]
}

export interface ProjectTree {
  /** Worktrees in no folder (new worktrees land here). */
  root: Worktree[]
  folders: FolderView[]
}

/** Splits a project's worktrees into folders and the root; ids that are not in `worktrees` are ignored. */
export function groupByFolder(worktrees: Worktree[], folders: WorktreeFolder[]): ProjectTree {
  const owner = new Map<string, string>()
  for (const f of folders) for (const id of f.worktreeIds) if (!owner.has(id)) owner.set(id, f.id)
  return {
    root: worktrees.filter((w) => !owner.has(w.id)),
    folders: folders.map((folder) => ({ folder, worktrees: worktrees.filter((w) => owner.get(w.id) === folder.id) })),
  }
}

/** The folder holding `worktreeId`, or null at the root. */
export const folderOf = (folders: WorktreeFolder[], worktreeId: string): WorktreeFolder | null =>
  folders.find((f) => f.worktreeIds.includes(worktreeId)) ?? null
