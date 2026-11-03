import { EventEmitter } from 'node:events'
import { CoreIpc, type PaletteId, type ThemeState } from '@pragma/sdk'
import { createMemoryTransport, IpcRouter } from '@pragma/sdk/runtime/main'
import { memoryLogger } from '@pragma/test-support'
import { palettes } from '@pragma/ui/tokens'
import { describe, expect, it, vi } from 'vitest'
import {
  TITLEBAR_HEIGHT,
  TRAFFIC_LIGHT_POSITION,
  TRANSPARENT_COLOR,
  WINDOW_VIBRANCY,
  WINDOW_VISUAL_EFFECT_STATE,
} from '../src/constants'
import {
  type ChromeWindow,
  registerWindowHandlers,
  watchWindowChrome,
  windowChromeOptions,
} from '../src/main/window-chrome'

const dark = palettes.vscode.dark
const light = palettes.vscode.light
const theme = (resolved: 'dark' | 'light', palette: PaletteId = 'vscode'): ThemeState => ({
  mode: 'system',
  palette,
  density: 'compact',
  resolved,
  tokens: { ...palettes[palette][resolved] },
})
const glass = (resolved: 'dark' | 'light' = 'dark'): ThemeState => theme(resolved, 'glass')

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
  setVibrancy = vi.fn()
  isFullScreen = (): boolean => this.fullScreen
}

function setup(platform: string, opts: { initial?: ThemeState; reduced?: () => boolean } = {}) {
  const log = memoryLogger()
  const memory = createMemoryTransport()
  const router = new IpcRouter(memory.transport, log)
  const published: boolean[] = []
  vi.spyOn(router, 'publish').mockImplementation((_event, payload) => void published.push(payload as boolean))
  let listener: ((s: ThemeState) => void) | undefined
  const themeApi = {
    get: () => opts.initial ?? theme('dark'),
    onChange: (cb: (s: ThemeState) => void) => {
      listener = cb
      return { dispose: () => (listener = undefined) }
    },
  }
  const win = new FakeWindow()
  watchWindowChrome(win, { router, theme: themeApi, platform, reducedTransparency: opts.reduced })
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

describe('glass window backdrop', () => {
  it('macOS opens a glass window with vibrancy behind a transparent background', () => {
    expect(windowChromeOptions('darwin', glass())).toMatchObject({
      backgroundColor: TRANSPARENT_COLOR,
      vibrancy: WINDOW_VIBRANCY,
      visualEffectState: WINDOW_VISUAL_EFFECT_STATE,
    })
  })

  it('reduced transparency keeps a macOS glass window opaque', () => {
    const options = windowChromeOptions('darwin', glass(), true)
    expect(options.backgroundColor).toBe(palettes.glass.dark.bg)
    expect(options).not.toHaveProperty('vibrancy')
  })

  it.each(['linux', 'win32'])('%s keeps an opaque window and see-through window controls', (platform) => {
    const options = windowChromeOptions(platform, glass('light'))
    expect(options).not.toHaveProperty('vibrancy')
    expect(options.backgroundColor).toBe(palettes.glass.light.bg)
    expect(options.titleBarOverlay).toMatchObject({ color: TRANSPARENT_COLOR, symbolColor: palettes.glass.light.tx })
  })

  it('switching to glass and back toggles vibrancy at runtime on macOS', () => {
    const { win, emitTheme } = setup('darwin')
    emitTheme(glass())
    expect(win.setVibrancy).toHaveBeenLastCalledWith(WINDOW_VIBRANCY)
    expect(win.setBackgroundColor).toHaveBeenLastCalledWith(TRANSPARENT_COLOR)
    emitTheme(glass('light'))
    expect(win.setVibrancy).toHaveBeenCalledTimes(1)
    emitTheme(theme('light'))
    expect(win.setVibrancy).toHaveBeenLastCalledWith(null)
    expect(win.setBackgroundColor).toHaveBeenLastCalledWith(light.bg)
    expect(win.setVibrancy).toHaveBeenCalledTimes(2)
  })

  it('a window opened in glass leaves its vibrancy alone until the palette changes', () => {
    const { win, emitTheme } = setup('darwin', { initial: glass() })
    emitTheme(glass('light'))
    expect(win.setVibrancy).not.toHaveBeenCalled()
    expect(win.setBackgroundColor).toHaveBeenLastCalledWith(TRANSPARENT_COLOR)
  })

  it('reduced transparency never turns vibrancy on', () => {
    const { win, emitTheme } = setup('darwin', { reduced: () => true })
    emitTheme(glass())
    expect(win.setVibrancy).not.toHaveBeenCalled()
    expect(win.setBackgroundColor).toHaveBeenLastCalledWith(palettes.glass.dark.bg)
  })

  it('never asks for vibrancy off macOS', () => {
    const { win, emitTheme } = setup('linux')
    emitTheme(glass())
    expect(win.setVibrancy).not.toHaveBeenCalled()
    expect(win.setTitleBarOverlay).toHaveBeenLastCalledWith(expect.objectContaining({ color: TRANSPARENT_COLOR }))
  })
})
