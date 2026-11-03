import { CoreIpc, type ThemeApi, type ThemeState, type TokenName } from '@pragma/sdk'
import type { IpcRouter } from '@pragma/sdk/runtime/main'
import { isTranslucentPalette } from '@pragma/ui/tokens'
import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from 'electron'
import { wantsVibrancy } from '../backdrop'
import {
  DARWIN,
  TITLEBAR_HEIGHT,
  TRAFFIC_LIGHT_POSITION,
  TRANSPARENT_COLOR,
  WINDOW_VIBRANCY,
  WINDOW_VISUAL_EFFECT_STATE,
} from '../constants'

const TOKEN = { bar: 'sb', text: 'tx', background: 'bg' } as const satisfies Record<string, TokenName>
const EVENTS = { enter: 'enter-full-screen', leave: 'leave-full-screen', closed: 'closed' } as const

type ChromeOptions = Pick<
  BrowserWindowConstructorOptions,
  | 'titleBarStyle'
  | 'trafficLightPosition'
  | 'titleBarOverlay'
  | 'fullscreenable'
  | 'backgroundColor'
  | 'vibrancy'
  | 'visualEffectState'
>
type Vibrancy = NonNullable<BrowserWindowConstructorOptions['vibrancy']>

/** The window surface the chrome needs; a `BrowserWindow` satisfies it. */
export interface ChromeWindow {
  on(event: string, listener: () => void): unknown
  isFullScreen(): boolean
  setTitleBarOverlay(options: TitleBarOverlayOptions): void
  setBackgroundColor(color: string): void
  setVibrancy(type: Vibrancy | null): void
}

/** Translucent palettes leave the window controls see-through, over the renderer's glass title bar. */
const overlay = (theme: ThemeState): TitleBarOverlayOptions => ({
  color: isTranslucentPalette(theme.palette) ? TRANSPARENT_COLOR : theme.tokens[TOKEN.bar],
  symbolColor: theme.tokens[TOKEN.text],
  height: TITLEBAR_HEIGHT,
})

/** The window background: transparent while vibrancy shows through, else the theme's background token. */
const backgroundOf = (theme: ThemeState, vibrant: boolean): string | undefined =>
  vibrant ? TRANSPARENT_COLOR : theme.tokens[TOKEN.background]

const vibrancyOptions = { vibrancy: WINDOW_VIBRANCY, visualEffectState: WINDOW_VISUAL_EFFECT_STATE } as const

/**
 * Frameless everywhere: macOS keeps its inset traffic lights; Windows and Linux hide the native title bar (and with it
 * the grey menu strip) and draw their window controls over ours, in the theme's colours. A translucent palette on
 * macOS starts the window with vibrancy behind a transparent background.
 */
export function windowChromeOptions(platform: string, theme: ThemeState, reducedTransparency = false): ChromeOptions {
  const vibrant = wantsVibrancy(platform, theme.palette, reducedTransparency)
  const base = {
    fullscreenable: true,
    backgroundColor: backgroundOf(theme, vibrant),
    ...(vibrant ? vibrancyOptions : {}),
  }
  return platform === DARWIN
    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: TRAFFIC_LIGHT_POSITION, ...base }
    : { titleBarStyle: 'hidden', titleBarOverlay: overlay(theme), ...base }
}

/** `core.window.fullScreen`: whether the current window is fullscreen (the title bar drops its traffic-light gutter). */
export function registerWindowHandlers(
  router: Pick<IpcRouter, 'handle'>,
  currentWindow: () => Pick<ChromeWindow, 'isFullScreen'> | undefined,
): void {
  router.handle(CoreIpc.windowFullScreen, () => currentWindow()?.isFullScreen() ?? false)
}

/**
 * Publishes fullscreen changes and keeps the window colours on the theme, for the window's lifetime. Switching to or
 * from a translucent palette turns macOS vibrancy on or off at runtime (`setVibrancy`), with the background to match.
 */
export function watchWindowChrome(
  win: ChromeWindow,
  deps: { router: Pick<IpcRouter, 'publish'>; theme: ThemeApi; platform: string; reducedTransparency?: () => boolean },
): void {
  const { router, theme, platform } = deps
  const reduced = deps.reducedTransparency ?? (() => false)
  const publish = (): void => router.publish(CoreIpc.windowFullScreenChanged, win.isFullScreen())
  win.on(EVENTS.enter, publish)
  win.on(EVENTS.leave, publish)
  let vibrant = wantsVibrancy(platform, theme.get().palette, reduced())
  const themed = theme.onChange((state) => {
    const next = wantsVibrancy(platform, state.palette, reduced())
    if (next !== vibrant) win.setVibrancy(next ? WINDOW_VIBRANCY : null)
    vibrant = next
    const background = backgroundOf(state, vibrant)
    if (background) win.setBackgroundColor(background)
    if (platform !== DARWIN) win.setTitleBarOverlay(overlay(state))
  })
  win.on(EVENTS.closed, () => themed.dispose())
}
