import { z } from '@pragma/sdk'
import { ABSOLUTE_OR_HOME_PATH_RE, DEFAULT_WORKTREES_ROOT } from '../constants'
import { PROJECTS_ERROR_CODES } from './errors'

const id = z.string().min(1)
const int = z.number().int()
const count = int.nonnegative()

export const ProjectSchema = z.object({
  id,
  name: z.string(),
  repoPath: z.string(),
  defaultBaseBranch: z.string(),
  createdAt: int,
  sortOrder: int,
})
export type Project = z.infer<typeof ProjectSchema>

/** `branch: null` means a detached HEAD. */
export const WorktreeSchema = z.object({
  id,
  projectId: id,
  path: z.string(),
  branch: z.string().nullable(),
  baseBranch: z.string(),
  isMain: z.boolean(),
  createdAt: int,
  archivedAt: int.nullable(),
})
export type Worktree = z.infer<typeof WorktreeSchema>

export const BRANCH_KINDS = ['local', 'remote'] as const
export type BranchKind = (typeof BRANCH_KINDS)[number]
export const BranchInfoSchema = z.object({
  name: z.string(),
  kind: z.enum(BRANCH_KINDS),
  checkedOutAt: z.string().nullable(),
})
export type BranchInfo = z.infer<typeof BranchInfoSchema>

export const WorktreeRemovalInfoSchema = z.object({
  worktreeId: id,
  isMain: z.boolean(),
  branch: z.string().nullable(),
  changedFiles: count,
  unmergedCommits: count.nullable(),
})
export type WorktreeRemovalInfo = z.infer<typeof WorktreeRemovalInfoSchema>

/** Upstream tracking state from `git status`; all null when the branch has no upstream. */
export const WorktreeSyncStateSchema = z.object({
  upstream: z.string().nullable(),
  ahead: count.nullable(),
  behind: count.nullable(),
})
export type WorktreeSyncState = z.infer<typeof WorktreeSyncStateSchema>

export const ProjectsSnapshotSchema = z.object({
  projects: z.array(ProjectSchema),
  worktrees: z.array(WorktreeSchema),
  changedFiles: z.record(z.string(), count),
  sync: z.record(z.string(), WorktreeSyncStateSchema),
  projectErrors: z.record(z.string(), z.enum(PROJECTS_ERROR_CODES)),
  activeWorktreeId: z.string().nullable(),
})
export type ProjectsSnapshot = z.infer<typeof ProjectsSnapshotSchema>

/** `worktreesRoot` is absolute or starts with `~`. */
export const ProjectsSettingsSchema = z.object({
  worktreesRoot: z.string().min(1).regex(ABSOLUTE_OR_HOME_PATH_RE),
})
export type ProjectsSettings = z.infer<typeof ProjectsSettingsSchema>
export const DEFAULT_PROJECTS_SETTINGS: ProjectsSettings = { worktreesRoot: DEFAULT_WORKTREES_ROOT }

export const CreateWorktreeInputSchema = z.object({
  projectId: id,
  branch: z.string().min(1),
  baseBranch: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
})
export type CreateWorktreeInput = z.infer<typeof CreateWorktreeInputSchema>
