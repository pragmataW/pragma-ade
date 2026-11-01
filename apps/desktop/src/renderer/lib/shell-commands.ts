import { CoreCommands, type Disposable, z } from '@pragma/sdk'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'
import type { ShellStore } from './shell-store'

const IdArgs = z.object({ id: z.string() })
const SettingsArgs = z.object({ pageId: z.string().optional() }).optional()

/** The `core.*` shell commands (palette-visible), so main-side modules can reveal UI via `ctx.commands.execute`. */
export function registerShellCommands(
  host: Pick<RendererHost, 'commands' | 'registries'>,
  store: ShellStore,
): Disposable[] {
  const set = store.setState
  const { commands, registries } = host
  const showMain = { settingsOpen: false }
  return [
    commands.register(
      { id: CoreCommands.openSettings, args: SettingsArgs },
      (a) => set({ settingsOpen: true, settingsPage: a?.pageId ?? null }),
      { titleKey: 'core:commands.openSettings', palette: true },
    ),
    commands.register(CoreCommands.commandPalette, () => set({ paletteOpen: true }), {
      titleKey: 'core:commands.commandPalette',
      palette: false,
    }),
    commands.register(CoreCommands.toggleSidebar, () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })), {
      titleKey: 'core:commands.toggleSidebar',
      palette: true,
    }),
    commands.register(CoreCommands.toggleRightPanel, () => set((s) => ({ rightCollapsed: !s.rightCollapsed })), {
      titleKey: 'core:commands.toggleRightPanel',
      palette: true,
    }),
    commands.register(
      CoreCommands.maximizeRightPanel,
      () => set((s) => ({ rightMaximized: !s.rightMaximized, rightCollapsed: false })),
      {
        titleKey: 'core:commands.maximizeRightPanel',
        palette: true,
      },
    ),
    commands.register({ id: CoreCommands.activateRightTab, args: IdArgs }, ({ id }) => {
      registries.activateRightTab(id)
      set({ ...showMain, rightCollapsed: false })
    }),
    commands.register({ id: CoreCommands.activateView, args: IdArgs }, ({ id }) => {
      registries.activateView(id)
      set(showMain)
    }),
  ]
}
