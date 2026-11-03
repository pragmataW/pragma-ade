import { randomUUID } from 'node:crypto'
import { z } from '@pragma/sdk'
import { FOLDERS_STATE_KEY_PREFIX } from '../constants'
import {
  FolderNameSchema,
  type FoldersSnapshot,
  PROJECTS_ERROR,
  ProjectsError,
  type Worktree,
  type WorktreeFolder,
  WorktreeFolderSchema,
} from '../contract'
import type { ProjectsRepo } from './repo'

/** Migration-safe read of one stored folder: missing or broken optional fields get their defaults. */
const StoredFolderSchema = WorktreeFolderSchema.extend({
  collapsed: z.boolean().catch(false),
  worktreeIds: z.array(z.string()).catch([]),
})
const StoredFoldersSchema = z.object({ folders: z.array(z.unknown()).catch([]) }).catch({ folders: [] })

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The stored folders of a project; an unreadable value means none, an unreadable folder is skipped. */
function parseStored(raw: string | null): WorktreeFolder[] {
  if (raw === null) return []
  return StoredFoldersSchema.parse(parseJson(raw)).folders.flatMap((f) => {
    const r = StoredFolderSchema.safeParse(f)
    return r.success ? [r.data] : []
  })
}

/** Keeps only live worktree ids, each in one folder (the first that names it). */
export function pruneFolders(folders: WorktreeFolder[], liveIds: ReadonlySet<string>): WorktreeFolder[] {
  const seen = new Set<string>()
  const keep = (id: string): boolean => {
    if (!liveIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  }
  return folders.map((f) => ({ ...f, worktreeIds: f.worktreeIds.filter(keep) }))
}

const without = (folders: WorktreeFolder[], worktreeId: string): WorktreeFolder[] =>
  folders.map((f) => ({ ...f, worktreeIds: f.worktreeIds.filter((id) => id !== worktreeId) }))

function requireFolder(folders: WorktreeFolder[], folderId: string): void {
  if (!folders.some((f) => f.id === folderId)) throw new ProjectsError(PROJECTS_ERROR.folderNotFound, folderId)
}

function requireName(name: string): string {
  const r = FolderNameSchema.safeParse(name)
  if (!r.success) throw new ProjectsError(PROJECTS_ERROR.invalidFolderName, name)
  return r.data
}

export interface FolderStoreDeps {
  repo: ProjectsRepo
  /** Called after every change (the wiring publishes `foldersChanged`). */
  onChanged: () => void
  newId?: () => string
}

/**
 * Per-project sidebar folders, persisted as JSON in `projects_state` (`folders:<projectId>`). Every read
 * drops worktrees that are no longer live, so removed worktrees leave their folders silently and new
 * worktrees (in no folder) show at the project root.
 */
export function createFolderStore({ repo, onChanged, newId = randomUUID }: FolderStoreDeps) {
  const key = (projectId: string): string => `${FOLDERS_STATE_KEY_PREFIX}${projectId}`
  const list = (projectId: string): WorktreeFolder[] =>
    pruneFolders(parseStored(repo.getState(key(projectId))), new Set(repo.listWorktrees(projectId).map((w) => w.id)))

  const update = (projectId: string, change: (folders: WorktreeFolder[]) => WorktreeFolder[]): void => {
    if (!repo.getProject(projectId)) throw new ProjectsError(PROJECTS_ERROR.projectNotFound, projectId)
    repo.setState(key(projectId), JSON.stringify({ folders: change(list(projectId)) }))
    onChanged()
  }
  const patch = (projectId: string, folderId: string, change: Partial<WorktreeFolder>): void =>
    update(projectId, (folders) => {
      requireFolder(folders, folderId)
      return folders.map((f) => (f.id === folderId ? { ...f, ...change } : f))
    })
  const liveWorktree = (worktreeId: string, projectId?: string): Worktree => {
    const w = repo.getWorktree(worktreeId)
    const live = w && w.archivedAt === null && repo.getProject(w.projectId)
    if (!live || (projectId !== undefined && w.projectId !== projectId))
      throw new ProjectsError(PROJECTS_ERROR.worktreeNotFound, worktreeId)
    return w
  }

  return {
    list,
    snapshot: (): FoldersSnapshot => Object.fromEntries(repo.listProjects().map((p) => [p.id, list(p.id)])),

    create(projectId: string, name: string, worktreeId?: string): WorktreeFolder {
      const folder: WorktreeFolder = { id: newId(), name: requireName(name), collapsed: false, worktreeIds: [] }
      if (worktreeId !== undefined) folder.worktreeIds = [liveWorktree(worktreeId, projectId).id]
      update(projectId, (folders) => [...without(folders, worktreeId ?? ''), folder])
      return folder
    },
    rename(projectId: string, folderId: string, name: string): void {
      patch(projectId, folderId, { name: requireName(name) })
    },
    setCollapsed(projectId: string, folderId: string, collapsed: boolean): void {
      patch(projectId, folderId, { collapsed })
    },
    /** Drops the folder only; its worktrees are back at the project root. */
    remove(projectId: string, folderId: string): void {
      update(projectId, (folders) => {
        requireFolder(folders, folderId)
        return folders.filter((f) => f.id !== folderId)
      })
    },
    /** Into `folderId` (out of any other folder), or back to the root with `null`. */
    move(worktreeId: string, folderId: string | null): void {
      const w = liveWorktree(worktreeId)
      update(w.projectId, (folders) => {
        if (folderId !== null) requireFolder(folders, folderId)
        return without(folders, worktreeId).map((f) =>
          f.id === folderId ? { ...f, worktreeIds: [...f.worktreeIds, worktreeId] } : f,
        )
      })
    },
  }
}
export type FolderStore = ReturnType<typeof createFolderStore>
