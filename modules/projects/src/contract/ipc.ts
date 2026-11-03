import { defineIpc, defineIpcEvent, type Result, z } from '@pragma/sdk'
import { type ProjectsErrorDto, ProjectsErrorDtoSchema } from './errors'
import { PROJECTS_CHANNELS as C } from './ids'
import {
  BranchInfoSchema,
  CreateWorktreeInputSchema,
  FoldersSnapshotSchema,
  ProjectSchema,
  ProjectsSettingsSchema,
  ProjectsSnapshotSchema,
  WorktreeFolderSchema,
  WorktreeRemovalInfoSchema,
  WorktreeSchema,
  WorktreeSyncStateSchema,
} from './types'

/** The IPC form of `Result<T, ProjectsErrorDto>`: expected failures travel as values, not IPC errors. */
export function resultSchema<T>(value: z.ZodType<T>): z.ZodType<Result<T, ProjectsErrorDto>> {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), error: ProjectsErrorDtoSchema }),
  ]) as z.ZodType<Result<T, ProjectsErrorDto>>
}

const none = z.void()
const projectRef = z.object({ projectId: z.string() })
const worktreeRef = z.object({ worktreeId: z.string() })
const folderRef = projectRef.extend({ folderId: z.string() })
const mutation = <I, O>(channel: string, input: z.ZodType<I>, output: z.ZodType<O>) =>
  defineIpc({ channel, input, output: resultSchema(output) })

export const CreateWorktreeIpcInputSchema = CreateWorktreeInputSchema.extend({ select: z.boolean().optional() })
export const StatusChangedPayloadSchema = WorktreeSyncStateSchema.extend({
  worktreeId: z.string(),
  changedFiles: z.number().int().nonnegative(),
})
export type StatusChangedPayload = z.infer<typeof StatusChangedPayloadSchema>
export const SelectedPayloadSchema = z.object({ worktreeId: z.string().nullable() })

/** Renderer → main requests (`projects.*`). Every mutation answers `Result<T, ProjectsErrorDto>`. */
export const projectsIpc = {
  getState: defineIpc({ channel: C.getState, input: none, output: ProjectsSnapshotSchema }),
  pickFolder: defineIpc({ channel: C.pickFolder, input: none, output: z.object({ path: z.string().nullable() }) }),
  addProject: mutation(C.addProject, z.object({ path: z.string() }), ProjectSchema),
  removeProject: mutation(C.removeProject, projectRef, none),
  reorderProjects: mutation(C.reorderProjects, z.object({ projectIds: z.array(z.string()) }), none),
  syncProject: mutation(C.syncProject, projectRef, none),
  listBranches: mutation(C.listBranches, projectRef, z.array(BranchInfoSchema)),
  suggestWorktreePath: mutation(
    C.suggestWorktreePath,
    projectRef.extend({ branch: z.string() }),
    z.object({ path: z.string() }),
  ),
  createWorktree: mutation(C.createWorktree, CreateWorktreeIpcInputSchema, WorktreeSchema),
  getRemovalInfo: mutation(C.getRemovalInfo, worktreeRef, WorktreeRemovalInfoSchema),
  removeWorktree: mutation(C.removeWorktree, worktreeRef.extend({ deleteBranch: z.boolean() }), none),
  selectWorktree: mutation(C.selectWorktree, z.object({ worktreeId: z.string().nullable() }), none),
  setBaseBranch: mutation(C.setBaseBranch, worktreeRef.extend({ branch: z.string() }), WorktreeSchema),
  getSettings: defineIpc({ channel: C.getSettings, input: none, output: ProjectsSettingsSchema }),
  updateSettings: mutation(C.updateSettings, z.object({ worktreesRoot: z.string() }), ProjectsSettingsSchema),
  /** Sidebar folders (renderer-only organisation; git and the worktree list are untouched). */
  getFolders: defineIpc({ channel: C.getFolders, input: none, output: FoldersSnapshotSchema }),
  /** `worktreeId` moves that worktree into the new folder ("Move to folder › New folder…"). */
  createFolder: mutation(
    C.createFolder,
    projectRef.extend({ name: z.string(), worktreeId: z.string().optional() }),
    WorktreeFolderSchema,
  ),
  renameFolder: mutation(C.renameFolder, folderRef.extend({ name: z.string() }), none),
  /** Its worktrees go back to the project root; no worktree is removed. */
  deleteFolder: mutation(C.deleteFolder, folderRef, none),
  setFolderCollapsed: mutation(C.setFolderCollapsed, folderRef.extend({ collapsed: z.boolean() }), none),
  /** `folderId: null` takes the worktree out of its folder. */
  moveWorktreeToFolder: mutation(C.moveWorktreeToFolder, worktreeRef.extend({ folderId: z.string().nullable() }), none),
} as const

/** Main → renderer events (`ctx.ipc.publish`). */
export const projectsIpcEvents = {
  stateChanged: defineIpcEvent({ channel: C.stateChanged, payload: ProjectsSnapshotSchema }),
  statusChanged: defineIpcEvent({ channel: C.statusChanged, payload: StatusChangedPayloadSchema }),
  selected: defineIpcEvent({ channel: C.selected, payload: SelectedPayloadSchema }),
  foldersChanged: defineIpcEvent({ channel: C.foldersChanged, payload: FoldersSnapshotSchema }),
} as const
