import { createCssVariablesTheme, createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import {
  DEFAULT_TOKEN_COLOR,
  HIGHLIGHT_LANGS,
  PLAIN_LANG,
  SHIKI_THEME_NAME,
  SHIKI_VARIABLE_PREFIX,
} from '../constants/ui'

export interface HighlightToken {
  content: string
  /** `var(--shiki-token-*)` (mapped to `--syn-*` in markdown.css) or `var(--tx)`. */
  color: string
}
export interface HighlightResult {
  lines: HighlightToken[][]
}

const theme = createCssVariablesTheme({ name: SHIKI_THEME_NAME, variablePrefix: SHIKI_VARIABLE_PREFIX })
const SUPPORTED = new Set<string>(HIGHLIGHT_LANGS)

let instance: Promise<HighlighterCore> | undefined

/** The app's single Shiki instance (JS regex engine: no WASM, CSP-safe). 07 and 11a reuse it. */
export function getHighlighter(): Promise<HighlighterCore> {
  instance ??= createHighlighterCore({
    themes: [theme],
    langs: [
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/jsx.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/shellscript.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/go.mjs'),
      import('shiki/langs/rust.mjs'),
      import('shiki/langs/sql.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/diff.mjs'),
    ],
    engine: createJavaScriptRegexEngine(),
  })
  return instance
}

const langOf = (lang: string): string => (SUPPORTED.has(lang) ? lang : PLAIN_LANG)

export async function highlight(code: string, lang: string): Promise<HighlightResult> {
  const hl = await getHighlighter()
  const { tokens } = hl.codeToTokens(code, { lang: langOf(lang), theme: SHIKI_THEME_NAME })
  return {
    lines: tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color ?? DEFAULT_TOKEN_COLOR }))),
  }
}

/** Shiki's escaped `<pre class="shiki">…</pre>` HTML. */
export async function highlightToHtml(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter()
  return hl.codeToHtml(code, { lang: langOf(lang), theme: SHIKI_THEME_NAME })
}
