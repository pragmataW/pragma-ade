import { EventEmitter } from 'node:events'
import { CoreIpc, type ThemeState } from '@pragma/sdk'
import { createMemoryTransport, IpcRouter } from '@pragma/sdk/runtime/main'
import { memoryLogger } from '@pragma/test-support'
import { palettes } from '@pragma/ui/tokens'
import { describe, expect, it, vi } from 'vitest'
import { TITLEBAR_HEIGHT, TRAFFIC_LIGHT_POSITION } from '../src/constants'
import {
  type ChromeWindow,
  registerWindowHandlers,
  watchWindowChrome,
  windowChromeOptions,
} from '../src/main/window-chrome'

const dark = palettes.vscode.dark
const light = palettes.vscode.light
const theme = (resolved: 'dark' | 'light'): ThemeState => ({
  mode: 'system',
  palette: 'vscode',
  density: 'compact',
  resolved,
  tokens: { ...(resolved === 'dark' ? dark : light) },
})

describe('windowChromeOptions', () => {
  it('macOS keeps the inset traffic lights and stays fullscreenable', () => {
    expect(windowChromeOptions('darwin', theme('dark'))).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: TRAFFIC_LIGHT_POSITION,
      fullscreenable: true,
      backgroundColor: dark.bg,
    })
  })

  it.each(['linux', 'win32'])('%s hides the native title bar and overlays themed window controls', (platform) => {
    expect(windowChromeOptions(platform, theme('light'))).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: light.sb, symbolColor: light.tx, height: TITLEBAR_HEIGHT },
      fullscreenable: true,
      backgroundColor: light.bg,
    })
  })
})

class FakeWindow extends EventEmitter implements ChromeWindow {
  fullScreen = false
  setTitleBarOverlay = vi.fn()
  setBackgroundColor = vi.fn()
  isFullScreen = (): boolean => this.fullScreen
}

function setup(platform: string) {
  const log = memoryLogger()
  const memory = createMemoryTransport()
  const router = new IpcRouter(memory.transport, log)
  const published: boolean[] = []
  vi.spyOn(router, 'publish').mockImplementation((_event, payload) => void published.push(payload as boolean))
  let listener: ((s: ThemeState) => void) | undefined
  const themeApi = {
    get: () => theme('dark'),
    onChange: (cb: (s: ThemeState) => void) => {
      listener = cb
      return { dispose: () => (listener = undefined) }
    },
  }
  const win = new FakeWindow()
  watchWindowChrome(win, { router, theme: themeApi, platform })
  return { win, published, emitTheme: (s: ThemeState) => listener?.(s), hasListener: () => !!listener }
}

describe('watchWindowChrome', () => {
  it('publishes fullscreen changes', () => {
    const { win, published } = setup('darwin')
    win.fullScreen = true
    win.emit('enter-full-screen')
    win.fullScreen = false
    win.emit('leave-full-screen')
    expect(published).toEqual([true, false])
  })

  it('re-themes the overlay and background off macOS, and stops on close', () => {
    const { win, emitTheme, hasListener } = setup('linux')
    emitTheme(theme('light'))
    expect(win.setTitleBarOverlay).toHaveBeenCalledWith({
      color: light.sb,
      symbolColor: light.tx,
      height: TITLEBAR_HEIGHT,
    })
    expect(win.setBackgroundColor).toHaveBeenCalledWith(light.bg)
    win.emit('closed')
    expect(hasListener()).toBe(false)
  })

  it('core.window.fullScreen answers for the current window, false without one', () => {
    const handlers = new Map<string, () => unknown>()
    const router = { handle: (def: { channel: string }, fn: () => unknown) => void handlers.set(def.channel, fn) }
    let win: FakeWindow | undefined
    registerWindowHandlers(router as never, () => win)
    const answer = (): unknown => handlers.get(CoreIpc.windowFullScreen.channel)?.()
    expect(answer()).toBe(false)
    win = new FakeWindow()
    win.fullScreen = true
    expect(answer()).toBe(true)
  })

  it('never touches the overlay on macOS', () => {
    const { win, emitTheme } = setup('darwin')
    emitTheme(theme('light'))
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled()
    expect(win.setBackgroundColor).toHaveBeenCalledWith(light.bg)
  })
})
