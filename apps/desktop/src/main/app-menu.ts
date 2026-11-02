import { Menu, type MenuItemConstructorOptions } from 'electron'
import { DARWIN } from '../constants'

/**
 * macOS: the standard menus, so View › Toggle Full Screen (⌃⌘F) and Window › Zoom exist. Elsewhere no menu bar: the
 * title bar is ours, and app shortcuts come from the SDK shortcut registry.
 */
export function appMenuTemplate(platform: string): MenuItemConstructorOptions[] | null {
  if (platform !== DARWIN) return null
  return [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]
}

export function installAppMenu(platform: string): void {
  const template = appMenuTemplate(platform)
  Menu.setApplicationMenu(template ? Menu.buildFromTemplate(template) : null)
}
