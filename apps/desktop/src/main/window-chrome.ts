import { CoreIpc, type ThemeApi, type ThemeState, type TokenName } from '@pragma/sdk'
import type { IpcRouter } from '@pragma/sdk/runtime/main'
import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from 'electron'
import { DARWIN, TITLEBAR_HEIGHT, TRAFFIC_LIGHT_POSITION } from '../constants'

const TOKEN = { bar: 'sb', text: 'tx', background: 'bg' } as const satisfies Record<string, TokenName>
const EVENTS = { enter: 'enter-full-screen', leave: 'leave-full-screen', closed: 'closed' } as const

type ChromeOptions = Pick<
  BrowserWindowConstructorOptions,
  'titleBarStyle' | 'trafficLightPosition' | 'titleBarOverlay' | 'fullscreenable' | 'backgroundColor'
>

/** The window surface the chrome needs; a `BrowserWindow` satisfies it. */
export interface ChromeWindow {
  on(event: string, listener: () => void): unknown
  isFullScreen(): boolean
  setTitleBarOverlay(options: TitleBarOverlayOptions): void
  setBackgroundColor(color: string): void
}

const overlay = (tokens: ThemeState['tokens']): TitleBarOverlayOptions => ({
  color: tokens[TOKEN.bar],
  symbolColor: tokens[TOKEN.text],
  height: TITLEBAR_HEIGHT,
})

/**
 * Frameless everywhere: macOS keeps its inset traffic lights; Windows and Linux hide the native title bar (and with it
 * the grey menu strip) and draw their window controls over ours, in the theme's colours.
 */
export function windowChromeOptions(platform: string, theme: ThemeState): ChromeOptions {
  const base = { fullscreenable: true, backgroundColor: theme.tokens[TOKEN.background] }
  return platform === DARWIN
    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: TRAFFIC_LIGHT_POSITION, ...base }
    : { titleBarStyle: 'hidden', titleBarOverlay: overlay(theme.tokens), ...base }
}

/** `core.window.fullScreen`: whether the current window is fullscreen (the title bar drops its traffic-light gutter). */
export function registerWindowHandlers(
  router: Pick<IpcRouter, 'handle'>,
  currentWindow: () => Pick<ChromeWindow, 'isFullScreen'> | undefined,
): void {
  router.handle(CoreIpc.windowFullScreen, () => currentWindow()?.isFullScreen() ?? false)
}

/** Publishes fullscreen changes and keeps the window colours on the theme, for the window's lifetime. */
export function watchWindowChrome(
  win: ChromeWindow,
  deps: { router: Pick<IpcRouter, 'publish'>; theme: ThemeApi; platform: string },
): void {
  const { router, theme, platform } = deps
  const publish = (): void => router.publish(CoreIpc.windowFullScreenChanged, win.isFullScreen())
  win.on(EVENTS.enter, publish)
  win.on(EVENTS.leave, publish)
  const themed = theme.onChange((state) => {
    const background = state.tokens[TOKEN.background]
    if (background) win.setBackgroundColor(background)
    if (platform !== DARWIN) win.setTitleBarOverlay(overlay(state.tokens))
  })
  win.on(EVENTS.closed, () => themed.dispose())
}
