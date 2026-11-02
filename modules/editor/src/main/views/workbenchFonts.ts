import { FONT_MONO, FONT_SANS } from '@pragma/ui/tokens'
import { DATA_URL_BASE64_MARKER, WC_EVENTS, WORKBENCH_FONT_SELECTORS } from '../../constants'

/** One `@font-face` worth of font: woff2 bytes as base64 plus its descriptors. */
export interface FontFile {
  family: string
  weight: string
  unicodeRange: string
  base64: string
}

/** The part of `WebContents` the fonts need (tests pass fakes). */
export interface FontTarget {
  on(event: typeof WC_EVENTS.domReady, listener: () => void): unknown
  insertCSS(css: string): Promise<unknown>
  executeJavaScript(code: string): Promise<unknown>
}

const QUOTES_RE = /^['"]|['"]$/g

/** First family of a CSS font stack, unquoted (`'Inter Variable', Inter, …` → `Inter Variable`). */
export const primaryFamily = (stack: string): string => (stack.split(',')[0] ?? '').trim().replace(QUOTES_RE, '')

/** The base64 payload of a `data:…;base64,…` URL (what a Vite `?inline` asset import gives). */
export const dataUrlBase64 = (url: string): string =>
  url.slice(url.indexOf(DATA_URL_BASE64_MARKER) + DATA_URL_BASE64_MARKER.length)

/** The workbench reads its fonts from these variables; the user's `workbench.experimental.fontFamily` still wins. */
export function workbenchFontCss(): string {
  return `${WORKBENCH_FONT_SELECTORS.join(', ')} { --monaco-font: ${FONT_SANS} !important; --monaco-monospace-font: ${FONT_MONO} !important; }`
}

/** Adds the faces from bytes: the workbench CSP (`font-src 'self' blob:`) blocks `data:` URLs in `@font-face`. */
export function fontFaceScript(files: readonly FontFile[]): string {
  return `(() => {
  for (const f of ${JSON.stringify(files)}) {
    const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))
    document.fonts.add(new FontFace(f.family, bytes, { weight: f.weight, unicodeRange: f.unicodeRange, display: 'swap' }))
  }
})()`
}

/** On every load of the workbench page: the app's UI and code fonts instead of the platform ones. */
export function applyWorkbenchFonts(
  wc: FontTarget,
  files: readonly FontFile[],
  log: (m: string, e: unknown) => void,
): void {
  const css = workbenchFontCss()
  const script = fontFaceScript(files)
  wc.on(WC_EVENTS.domReady, () => {
    wc.insertCSS(css).catch((e: unknown) => log('workbench font css failed', e))
    wc.executeJavaScript(script).catch((e: unknown) => log('workbench font faces failed', e))
  })
}
