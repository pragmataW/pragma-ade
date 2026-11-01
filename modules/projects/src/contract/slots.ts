import { z } from '@pragma/sdk'

/** Props of every `sidebar.worktreeRow.*` slot entry. */
export const WorktreeRowSlotPropsSchema = z.object({
  worktreeId: z.string(),
  projectId: z.string(),
  isActive: z.boolean(),
})
export type WorktreeRowSlotProps = z.infer<typeof WorktreeRowSlotPropsSchema>
