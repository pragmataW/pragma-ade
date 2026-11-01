import { EventEmitter } from 'node:events'
import { beforeEach, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ focused: null as object | null }))
const electron = vi.hoisted(() => {
  const { EventEmitter: Emitter } = require('node:events') as typeof import('node:events')
  const app = Object.assign(new Emitter(), { isPackaged: false })
  const nativeTheme = Object.assign(new Emitter(), { themeSource: 'system', shouldUseDarkColors: true })
  return {
    app,
    nativeTheme,
    BrowserWindow: { getFocusedWindow: () => state.focused },
    dialog: { showMessageBox: vi.fn(async () => ({ response: 0 })), showOpenDialog: vi.fn() },
    shell: { openExternal: vi.fn(async () => undefined) },
    Notification: vi.fn(),
  }
})
vi.mock('electron', () => electron)

const { createElectronPlatform } = await import('../src/main/electron-platform')

beforeEach(() => {
  state.focused = null
})

test('confirm maps to showMessageBox with buttons [confirm, cancel]', async () => {
  const ok = await createElectronPlatform().dialogs.confirm({
    title: 'T',
    message: 'M',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  })
  expect(ok).toBe(true)
  expect(electron.dialog.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ buttons: ['Yes', 'No'], defaultId: 0, cancelId: 1, title: 'T', message: 'M' }),
  )
})
test('openExternal delegates', async () => {
  await createElectronPlatform().openExternal('https://example.com')
  expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com')
})
test('theme.setSource sets nativeTheme.themeSource', () => {
  createElectronPlatform().theme.setSource('light')
  expect(electron.nativeTheme.themeSource).toBe('light')
})
test('window focus events map to onFocusChange(true/false) without duplicates', async () => {
  const cb = vi.fn()
  createElectronPlatform().window.onFocusChange(cb)
  const tick = () => new Promise((r) => setImmediate(r))
  state.focused = {}
  electron.app.emit('browser-window-focus')
  electron.app.emit('browser-window-focus')
  await tick()
  state.focused = null
  electron.app.emit('browser-window-blur')
  await tick()
  expect(cb.mock.calls).toEqual([[true], [false]])
  expect(EventEmitter).toBeDefined()
})
