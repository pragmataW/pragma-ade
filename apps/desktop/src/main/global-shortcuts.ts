import { CoreCommands, type ShortcutSpec } from '@pragma/sdk'
import type { CommandRegistry, ShortcutRegistry } from '@pragma/sdk/runtime/main'
import type { BrowserWindow } from 'electron'
import { PALETTE_ACCELERATOR, SETTINGS_ACCELERATOR } from '../constants'

/** App-scoped: CmdOrCtrl+K is a VS Code chord, so it must not be captured inside editor/browser views (§10.2). */
export const CORE_SHORTCUTS: ShortcutSpec[] = [
  {
    id: CoreCommands.commandPalette,
    accelerator: PALETTE_ACCELERATOR,
    scope: 'app',
    command: CoreCommands.commandPalette,
    titleKey: 'core:commands.commandPalette',
  },
  {
    id: CoreCommands.openSettings,
    accelerator: SETTINGS_ACCELERATOR,
    scope: 'app',
    command: CoreCommands.openSettings,
    titleKey: 'core:commands.openSettings',
  },
]

export function registerCoreShortcuts(shortcuts: ShortcutRegistry): void {
  for (const spec of CORE_SHORTCUTS) shortcuts.register(spec)
}

/**
 * Placeholder: app-scope shortcuts are matched in the renderer and global ones by the view container; nothing is
 * registered OS-wide.
 */
export function installAppShortcutForwarding(
  _win: BrowserWindow,
  _shortcuts: ShortcutRegistry,
  _commands: CommandRegistry,
): void {}
