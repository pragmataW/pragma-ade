import { z } from 'zod'

/** Layout slots the shell opens (§4.5, §10.2). */
export const ShellSlots = {
  sidebarMain: 'sidebar.main',
  sidebarFooter: 'sidebar.footer',
  titlebarLeft: 'titlebar.left',
  titlebarRight: 'titlebar.right',
  statusbarLeft: 'statusbar.left',
  statusbarRight: 'statusbar.right',
} as const
export type ShellSlotId = (typeof ShellSlots)[keyof typeof ShellSlots]

/** Shell commands; main-side modules reveal UI through `ctx.commands.execute`. */
export const CoreCommands = {
  openSettings: 'core.openSettings',
  commandPalette: 'core.commandPalette',
  toggleSidebar: 'core.toggleSidebar',
  toggleRightPanel: 'core.toggleRightPanel',
  maximizeRightPanel: 'core.maximizeRightPanel',
  activateRightTab: 'core.activateRightTab',
  activateView: 'core.activateView',
  swapSidePanels: 'core.swapSidePanels',
  moveDockLeft: 'core.moveDockLeft',
  moveDockRight: 'core.moveDockRight',
  moveDockTop: 'core.moveDockTop',
  moveDockBottom: 'core.moveDockBottom',
  resetLayout: 'core.resetLayout',
} as const

/** Fixed settings page order (§10.4); out-of-tree pages use values above 1000. */
export const SETTINGS_PAGE_ORDER = {
  general: 10,
  appearance: 20,
  modules: 30,
  shortcuts: 40,
  agents: 50,
  notifications: 60,
  comments: 70,
  editor: 80,
  browser: 90,
  board: 100,
  cli: 110,
  chat: 120,
  /** Last: features still in beta (switched off and on here). */
  beta: 9000,
} as const

export const RectSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
export type Rect = z.infer<typeof RectSchema>

export const InsetSchema = z.object({
  top: z.number().optional(),
  right: z.number().optional(),
  bottom: z.number().optional(),
  left: z.number().optional(),
})
export type Inset = z.infer<typeof InsetSchema>
