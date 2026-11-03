import { z } from '@pragma/sdk'

/** Props of every `sidebar.worktreeRow.*` slot entry. */
export const WorktreeRowSlotPropsSchema = z.object({
  worktreeId: z.string(),
  projectId: z.string(),
  isActive: z.boolean(),
})
export type WorktreeRowSlotProps = z.infer<typeof WorktreeRowSlotPropsSchema>

/** Props of `sidebar.worktreeFolder.leading` entries: the folder and its live member worktrees. */
export const WorktreeFolderSlotPropsSchema = z.object({
  projectId: z.string(),
  folderId: z.string(),
  worktreeIds: z.array(z.string()),
})
export type WorktreeFolderSlotProps = z.infer<typeof WorktreeFolderSlotPropsSchema>
