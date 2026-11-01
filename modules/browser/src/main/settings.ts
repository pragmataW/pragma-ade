import type { BrowserSettings } from '../contract'

/** Defaults match 05's formatter limits (outerHTML 2000, text 200, console errors 10). */
const BROWSER_SETTINGS_DEFAULTS: BrowserSettings = {
  searchUrl: 'https://duckduckgo.com/?q={query}',
  consoleBufferSize: 200,
  consoleErrorsInComment: 10,
  outerHtmlMaxChars: 2000,
  textMaxChars: 200,
  styleProps: [
    'display',
    'position',
    'width',
    'height',
    'margin',
    'padding',
    'color',
    'background-color',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'border',
    'border-radius',
    'gap',
    'opacity',
  ],
  maxLiveViews: 6,
  screenshotRetentionDays: 7,
  reactProbe: true,
}

export const browserSettingsDefaults: BrowserSettings = BROWSER_SETTINGS_DEFAULTS
