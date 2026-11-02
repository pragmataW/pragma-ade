import { expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ Menu: {} }))
const { appMenuTemplate } = await import('../src/main/app-menu')

it('macOS gets app, edit, view (with Toggle Full Screen) and window menus', () => {
  expect(appMenuTemplate('darwin')).toEqual([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ])
})

it.each(['linux', 'win32'])('%s has no menu bar (the title bar is ours)', (platform) => {
  expect(appMenuTemplate(platform)).toBeNull()
})
