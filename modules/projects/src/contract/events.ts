import { defineEvent, z } from '@pragma/sdk'
import { PROJECTS_EVENTS } from './ids'
import { WorktreeSchema } from './types'

/** `files`: debounced fs batch · `head`: commit/checkout/HEAD/index/ref change · `baseBranch`: `setBaseBranch`. */
export const WORKTREE_CHANGE_REASONS = ['files', 'head', 'baseBranch'] as const
export type WorktreeChangeReason = (typeof WORKTREE_CHANGE_REASONS)[number]
export const WORKTREE_REMOVE_REASONS = ['user', 'external', 'projectRemoved'] as const
export type WorktreeRemoveReason = (typeof WORKTREE_REMOVE_REASONS)[number]

export const WorktreeCreatedPayloadSchema = z.object({ worktree: WorktreeSchema })
export type WorktreeCreatedPayload = z.infer<typeof WorktreeCreatedPayloadSchema>

export const WorktreeRemovedPayloadSchema = z.object({
  worktreeId: z.string(),
  projectId: z.string(),
  path: z.string(),
  reason: z.enum(WORKTREE_REMOVE_REASONS),
})
export type WorktreeRemovedPayload = z.infer<typeof WorktreeRemovedPayloadSchema>

/** `changedPaths` are worktree-relative (capped; `truncated` when more changed); empty for `head`/`baseBranch`. */
export const WorktreeChangedPayloadSchema = z.object({
  worktreeId: z.string(),
  path: z.string(),
  reason: z.enum(WORKTREE_CHANGE_REASONS),
  changedPaths: z.array(z.string()),
  truncated: z.boolean(),
})
export type WorktreeChangedPayload = z.infer<typeof WorktreeChangedPayloadSchema>

export const WorktreeSelectedPayloadSchema = z.object({
  worktreeId: z.string().nullable(),
  previousWorktreeId: z.string().nullable(),
})
export type WorktreeSelectedPayload = z.infer<typeof WorktreeSelectedPayloadSchema>

export const ProjectRemovedPayloadSchema = z.object({ projectId: z.string(), repoPath: z.string() })
export type ProjectRemovedPayload = z.infer<typeof ProjectRemovedPayloadSchema>

export const worktreeCreated = defineEvent<WorktreeCreatedPayload>(PROJECTS_EVENTS.worktreeCreated)
export const worktreeRemoved = defineEvent<WorktreeRemovedPayload>(PROJECTS_EVENTS.worktreeRemoved)
export const worktreeChanged = defineEvent<WorktreeChangedPayload>(PROJECTS_EVENTS.worktreeChanged)
export const worktreeSelected = defineEvent<WorktreeSelectedPayload>(PROJECTS_EVENTS.worktreeSelected)
export const projectRemoved = defineEvent<ProjectRemovedPayload>(PROJECTS_EVENTS.projectRemoved)
