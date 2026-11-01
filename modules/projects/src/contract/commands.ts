import { defineCommand, z } from '@pragma/sdk'
import { PROJECTS_COMMANDS } from './ids'

export const SelectWorktreeArgsSchema = z.object({ worktreeId: z.string().nullable() })
export type SelectWorktreeArgs = z.infer<typeof SelectWorktreeArgsSchema>
export const AddProjectArgsSchema = z.object({}).optional()
export const NewWorktreeArgsSchema = z.object({ projectId: z.string().optional() }).optional()
export type NewWorktreeArgs = z.infer<typeof NewWorktreeArgsSchema>

/** `selectWorktree` is handled in main; `addProject` and `newWorktree` in the renderer. */
export const projectsCommands = {
  selectWorktree: defineCommand({ id: PROJECTS_COMMANDS.selectWorktree, args: SelectWorktreeArgsSchema }),
  addProject: defineCommand({ id: PROJECTS_COMMANDS.addProject, args: AddProjectArgsSchema }),
  newWorktree: defineCommand({ id: PROJECTS_COMMANDS.newWorktree, args: NewWorktreeArgsSchema }),
} as const
