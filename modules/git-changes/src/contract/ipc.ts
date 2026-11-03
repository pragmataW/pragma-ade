import { BRANCH_KINDS } from '@pragma/module-projects/contract'
import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import {
  ChangeListSchema,
  ChangeModeSchema,
  FileDiffContentsSchema,
  FileStatusSchema,
  RepoPathSchema,
  ShaSchema,
} from './schemas'

/** Renderer → main channels and the main → renderer event. */
export const GIT_CHANGES_CHANNELS = {
  list: 'git-changes.list',
  fileContents: 'git-changes.fileContents',
  listBranches: 'git-changes.listBranches',
  setBaseBranch: 'git-changes.setBaseBranch',
  changed: 'git-changes.changed',
} as const

const worktreeRef = { worktreeId: z.string().min(1) }

export const listChangesIpc = defineIpc({
  channel: GIT_CHANGES_CHANNELS.list,
  input: z.object({ ...worktreeRef, mode: ChangeModeSchema }),
  output: ChangeListSchema,
})

export const FileContentsInputSchema = z.object({
  ...worktreeRef,
  mode: ChangeModeSchema,
  path: RepoPathSchema,
  oldPath: RepoPathSchema.optional(),
  status: FileStatusSchema,
  /** Uncommitted mode: the staged side (HEAD ↔ index) instead of the unstaged one (index ↔ worktree). */
  staged: z.boolean().optional(),
  /** A file of this stash (`scm.stashFiles`): its base commit ↔ the stash (untracked files: absent ↔ `^3`). */
  stash: ShaSchema.optional(),
})
export type FileContentsInput = z.infer<typeof FileContentsInputSchema>
export const fileContentsIpc = defineIpc({
  channel: GIT_CHANGES_CHANNELS.fileContents,
  input: FileContentsInputSchema,
  output: FileDiffContentsSchema,
})

export const BaseBranchOptionSchema = z.object({ name: z.string(), kind: z.enum(BRANCH_KINDS) })
export type BaseBranchOption = z.infer<typeof BaseBranchOptionSchema>
export const listBranchesIpc = defineIpc({
  channel: GIT_CHANGES_CHANNELS.listBranches,
  input: z.object(worktreeRef),
  output: z.object({ branches: z.array(BaseBranchOptionSchema) }),
})

export const setBaseBranchIpc = defineIpc({
  channel: GIT_CHANGES_CHANNELS.setBaseBranch,
  input: z.object({ ...worktreeRef, baseBranch: z.string().min(1) }),
  output: z.object({}),
})

/** The worktree's changes may differ now (files, commits, refs or base branch): refetch. */
export const changesChangedEvent = defineIpcEvent({
  channel: GIT_CHANGES_CHANNELS.changed,
  payload: z.object(worktreeRef),
})

/** `gitChanges.toggleFileList` (renderer): collapses / expands the changed-files list. */
export const TOGGLE_FILE_LIST_COMMAND_ID = 'gitChanges.toggleFileList'

/**
 * `gitChanges.reveal {worktreeId, path, line?, side?, commentId?}` (renderer): shows the file in the Git Changes tab;
 * with `commentId` scrolls that thread's card into view, else with `line` (on `side`, default new) that row.
 */
export const REVEAL_COMMAND_ID = 'gitChanges.reveal'
export const REVEAL_SIDES = ['old', 'new'] as const
export const RevealArgsSchema = z.object({
  worktreeId: z.string().min(1),
  path: RepoPathSchema,
  line: z.number().int().min(1).optional(),
  side: z.enum(REVEAL_SIDES).optional(),
  commentId: z.string().min(1).optional(),
})
export type RevealArgs = z.infer<typeof RevealArgsSchema>
