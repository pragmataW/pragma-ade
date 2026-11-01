import { defineCommand, z } from '@pragma/sdk'

export const BROWSER_COMMANDS = { open: 'browser.open', togglePicker: 'browser.togglePicker' } as const

export const OpenArgsSchema = z.object({ worktreeId: z.string().min(1).optional(), url: z.string() })
export type OpenArgs = z.infer<typeof OpenArgsSchema>

/** `browser.open` (main) opens a tab in the given or active worktree; `browser.togglePicker` (main + renderer). */
export const browserCommands = {
  open: defineCommand({ id: BROWSER_COMMANDS.open, args: OpenArgsSchema }),
  togglePicker: defineCommand({ id: BROWSER_COMMANDS.togglePicker, args: z.unknown() }),
} as const
