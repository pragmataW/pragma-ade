import { z } from '@pragma/sdk'
import { PtyExitSchema } from './pty'

export const SPLIT = { none: 'none', horizontal: 'horizontal', vertical: 'vertical' } as const
export const SPLIT_DIRECTIONS = [SPLIT.none, SPLIT.horizontal, SPLIT.vertical] as const
export type SplitDirection = (typeof SPLIT_DIRECTIONS)[number]
/** `vertical` = side by side, `horizontal` = stacked. */
export const SPLIT_ACTIONS = [SPLIT.horizontal, SPLIT.vertical] as const
export type SplitAction = (typeof SPLIT_ACTIONS)[number]
export const MAX_PANES_PER_TAB = 2

export const TerminalPaneSchema = z.object({
  id: z.string(),
  /** Empty when the spawn failed (`error` set). */
  ptyId: z.string(),
  exit: PtyExitSchema.omit({ ptyId: true }).nullable(),
  error: z.string().nullable(),
})
export type TerminalPane = z.infer<typeof TerminalPaneSchema>

export const TerminalTabSchema = z.object({
  id: z.string(),
  ordinal: z.number().int(),
  customTitle: z.string().nullable(),
  split: z.enum(SPLIT_DIRECTIONS),
  panes: z.array(TerminalPaneSchema).min(1).max(MAX_PANES_PER_TAB),
  activePaneId: z.string(),
})
export type TerminalTab = z.infer<typeof TerminalTabSchema>

export const WorktreeTerminalLayoutSchema = z.object({
  worktreeId: z.string(),
  tabs: z.array(TerminalTabSchema),
  activeTabId: z.string().nullable(),
})
export type WorktreeTerminalLayout = z.infer<typeof WorktreeTerminalLayoutSchema>
