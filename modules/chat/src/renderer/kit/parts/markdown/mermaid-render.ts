import type { MermaidConfig } from 'mermaid'
import {
  FONT_UI_VAR,
  MERMAID_FONT_SIZE,
  MERMAID_ID_PREFIX,
  MERMAID_SECURITY,
  MERMAID_THEME,
  MERMAID_THEME_TOKENS,
} from '../../../../constants'

type MermaidApi = typeof import('mermaid')['default']

let loader: Promise<MermaidApi> | undefined
/** Mermaid is large; it loads (as its own chunk) the first time a diagram is shown. */
const loadMermaid = (): Promise<MermaidApi> => {
  loader ??= import('mermaid').then((m) => m.default)
  return loader
}

/** Mermaid keeps global state (config, a temp DOM node per render): renders run one at a time. */
let queue: Promise<unknown> = Promise.resolve()
let seq = 0

type ThemeVariables = Record<string, string | boolean>

/** The `base` theme filled from the app's resolved colour tokens (so every palette and mode matches). */
export function mermaidThemeVariables(dark: boolean, root: Element = document.documentElement): ThemeVariables {
  const style = getComputedStyle(root)
  const vars: ThemeVariables = { darkMode: dark, fontSize: MERMAID_FONT_SIZE }
  const font = style.getPropertyValue(FONT_UI_VAR).trim()
  if (font) vars.fontFamily = font
  for (const [key, token] of Object.entries(MERMAID_THEME_TOKENS)) {
    const value = style.getPropertyValue(token).trim()
    if (value) vars[key] = value
  }
  return vars
}

const configOf = (themeVariables: ThemeVariables): MermaidConfig => ({
  startOnLoad: false,
  // Sanitized SVG: no click handlers, no HTML labels, no raw HTML from the diagram text.
  securityLevel: MERMAID_SECURITY,
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  suppressErrorRendering: true,
  theme: MERMAID_THEME,
  themeVariables,
})

/** The diagram as sanitized SVG markup; rejects on a syntax error. */
export function renderMermaid(source: string, themeVariables: ThemeVariables): Promise<string> {
  const run = queue.then(async () => {
    const mermaid = await loadMermaid()
    mermaid.initialize(configOf(themeVariables))
    seq += 1
    const { svg } = await mermaid.render(`${MERMAID_ID_PREFIX}${seq}`, source)
    return svg
  })
  queue = run.catch(() => undefined)
  return run
}
