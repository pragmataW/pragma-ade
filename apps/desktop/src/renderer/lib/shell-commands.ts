import { CoreCommands, type Disposable, z } from '@pragma/sdk'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'
import { animateLayout } from './animate-layout'
import { DEFAULT_DOCK_LAYOUT, type DockLayout, type DockPosition, swapSides, writeDockLayout } from './dock-layout'
import type { ShellStore } from './shell-store'

const IdArgs = z.object({ id: z.string() })
const SettingsArgs = z.object({ pageId: z.string().optional() }).optional()

/** One palette command per dock position. */
export const MOVE_DOCK_COMMANDS: Record<DockPosition, { id: string; titleKey: string }> = {
  left: { id: CoreCommands.moveDockLeft, titleKey: 'core:commands.moveDockLeft' },
  right: { id: CoreCommands.moveDockRight, titleKey: 'core:commands.moveDockRight' },
  top: { id: CoreCommands.moveDockTop, titleKey: 'core:commands.moveDockTop' },
  bottom: { id: CoreCommands.moveDockBottom, titleKey: 'core:commands.moveDockBottom' },
}

/** Applies a dock layout: shows the dock, persists the choice in `core.layout`. */
export function setDockLayout(host: Pick<RendererHost, 'layout'>, store: ShellStore, next: DockLayout): void {
  animateLayout(() => store.setState({ ...next, rightCollapsed: false }))
  writeDockLayout(host.layout, next)
}

function registerLayoutCommands(host: Pick<RendererHost, 'commands' | 'layout'>, store: ShellStore): Disposable[] {
  const apply = (next: DockLayout) => setDockLayout(host, store, next)
  const current = (): DockLayout => {
    const { sidebarSide, dockPosition } = store.getState()
    return { sidebarSide, dockPosition }
  }
  return [
    host.commands.register(CoreCommands.swapSidePanels, () => apply(swapSides(current())), {
      titleKey: 'core:commands.swapSidePanels',
      palette: true,
    }),
    ...Object.entries(MOVE_DOCK_COMMANDS).map(([position, c]) =>
      host.commands.register(c.id, () => apply({ ...current(), dockPosition: position as DockPosition }), {
        titleKey: c.titleKey,
        palette: true,
      }),
    ),
    host.commands.register(CoreCommands.resetLayout, () => apply({ ...DEFAULT_DOCK_LAYOUT }), {
      titleKey: 'core:commands.resetLayout',
      palette: true,
    }),
  ]
}

/** The `core.*` shell commands (palette-visible), so main-side modules can reveal UI via `ctx.commands.execute`. */
export function registerShellCommands(
  host: Pick<RendererHost, 'commands' | 'registries' | 'layout'>,
  store: ShellStore,
): Disposable[] {
  const set = store.setState
  const { commands, registries } = host
  const showMain = { settingsOpen: false }
  return [
    ...registerLayoutCommands(host, store),
    commands.register(
      { id: CoreCommands.openSettings, args: SettingsArgs },
      (a) => set({ settingsOpen: true, settingsPage: a?.pageId ?? null }),
      { titleKey: 'core:commands.openSettings', palette: true },
    ),
    commands.register(CoreCommands.commandPalette, () => set({ paletteOpen: true }), {
      titleKey: 'core:commands.commandPalette',
      palette: false,
    }),
    commands.register(
      CoreCommands.toggleSidebar,
      () => animateLayout(() => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))),
      {
        titleKey: 'core:commands.toggleSidebar',
        palette: true,
      },
    ),
    commands.register(
      CoreCommands.toggleRightPanel,
      () => animateLayout(() => set((s) => ({ rightCollapsed: !s.rightCollapsed }))),
      {
        titleKey: 'core:commands.toggleRightPanel',
        palette: true,
      },
    ),
    commands.register(
      CoreCommands.maximizeRightPanel,
      () => animateLayout(() => set((s) => ({ rightMaximized: !s.rightMaximized, rightCollapsed: false }))),
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
