/** The fixed English template comments are delivered to agents in (§7.5; agent-facing, not i18n). Pure functions. */
import {
  BACKTICK,
  BACKTICK_RUN,
  ELLIPSIS,
  FORMAT_LIMITS,
  type FormatLimits,
  INDENT,
  MIN_FENCE,
  NESTED_INDENT,
  NEWLINE,
  TRAILING_SPACE_RE,
} from '../constants'
import { type BrowserElementContext, COMMENT_SOURCE, type Comment, DIFF_SIDE } from '../contract'
import { codeLocation } from '../lib/code-location'

export type FormattableComment = Pick<
  Comment,
  'source' | 'filePath' | 'lineStart' | 'lineEnd' | 'diffSide' | 'snippet' | 'language' | 'element' | 'body'
>

const TEMPLATE = {
  header: 'Review comments:',
  itemSeparator: '\n\n',
  oldVersion: ' (old version)',
  html: 'html',
  bullet: '- ',
  component: 'React component: ',
  boundingBox: 'Bounding box: ',
  screenshot: 'Screenshot: ',
  text: 'Text: ',
  styles: 'Styles: ',
  stylesSeparator: '; ',
  outerHtml: 'outerHTML:',
  consoleErrors: 'Console errors:',
} as const

const LANGUAGES = {
  ts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  json: 'json',
  go: 'go',
  css: 'css',
  scss: 'scss',
  html: 'html',
  sql: 'sql',
  java: 'java',
  swift: 'swift',
  php: 'php',
  c: 'c',
  h: 'c',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  kt: 'kotlin',
  rb: 'ruby',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
} as const
const EXTENSION_RE = /\.([^./\\]+)$/

/** The fence language for a path's extension (case-insensitive); undefined when unknown. */
export function languageFromPath(path: string | undefined): string | undefined {
  const ext = path ? EXTENSION_RE.exec(path)?.[1]?.toLowerCase() : undefined
  return ext && Object.hasOwn(LANGUAGES, ext) ? LANGUAGES[ext as keyof typeof LANGUAGES] : undefined
}

const indentLines = (text: string, indent: string): string[] =>
  text.split(NEWLINE).map((l) => (l.length ? indent + l : ''))

/** Backticks one longer than the longest run in `text` (at least `MIN_FENCE`). */
function fence(text: string): string {
  const longest = Math.max(0, ...(text.match(BACKTICK_RUN) ?? []).map((run) => run.length))
  return BACKTICK.repeat(Math.max(MIN_FENCE, longest + 1))
}

function fencedBlock(text: string, language: string, indent: string): string[] {
  const f = fence(text)
  return [indent + f + language, ...text.split(NEWLINE).map((l) => indent + l), indent + f]
}

function truncateLines(text: string, max: number): { text: string; more: number } {
  const all = text.split(NEWLINE)
  return all.length <= max ? { text, more: 0 } : { text: all.slice(0, max).join(NEWLINE), more: all.length - max }
}

function truncateChars(text: string, max: number): { text: string; more: number } {
  return text.length <= max ? { text, more: 0 } : { text: text.slice(0, max), more: text.length - max }
}

const ellipsize = (text: string, max: number): string => (text.length <= max ? text : text.slice(0, max) + ELLIPSIS)
const code = (s: string): string => BACKTICK + s + BACKTICK

function snippetLines(c: FormattableComment, limits: FormatLimits): string[] {
  if (!c.snippet) return []
  const byLines = truncateLines(c.snippet, limits.snippetMaxLines)
  const byChars = truncateChars(byLines.text, limits.snippetMaxChars)
  const notes = [
    byLines.more ? `${INDENT}(snippet truncated: ${byLines.more} more lines)` : '',
    byChars.more ? `${INDENT}(snippet truncated: ${byChars.more} more characters)` : '',
  ].filter(Boolean)
  const language = c.language ?? languageFromPath(c.filePath) ?? ''
  return [...fencedBlock(byChars.text, language, INDENT), ...notes]
}

function codeItem(c: FormattableComment, n: number, limits: FormatLimits): string[] {
  const old = c.diffSide === DIFF_SIDE.old ? TEMPLATE.oldVersion : ''
  return [`${n}. ${code(codeLocation(c))}${old}`, ...snippetLines(c, limits)]
}

const bullet = (text: string): string => INDENT + TEMPLATE.bullet + text

function outerHtmlLines(e: BrowserElementContext, limits: FormatLimits): string[] {
  const cut = truncateChars(e.outerHtml, limits.outerHtmlMaxChars)
  const note = cut.more
    ? [`${NESTED_INDENT}(outerHTML truncated: showing ${cut.text.length} of ${e.outerHtml.length} characters)`]
    : []
  return [bullet(TEMPLATE.outerHtml), ...fencedBlock(cut.text, TEMPLATE.html, NESTED_INDENT), ...note]
}

function consoleErrorLines(errors: readonly string[], limits: FormatLimits): string[] {
  if (!errors.length) return []
  const shown = errors.slice(0, limits.consoleErrorsMax).map((err) => ellipsize(err, limits.consoleErrorMaxChars))
  const more = errors.length - shown.length
  const rest = more > 0 ? [`(${more} more)`] : []
  return [bullet(TEMPLATE.consoleErrors), ...[...shown, ...rest].map((l) => NESTED_INDENT + TEMPLATE.bullet + l)]
}

function elementBullets(e: BrowserElementContext, limits: FormatLimits): string[] {
  const { x, y, width, height } = e.boundingBox
  const component = e.component
    ? `${TEMPLATE.component}${code(e.component.name)}${e.component.source ? ` (${e.component.source})` : ''}`
    : undefined
  const styles = e.styles && Object.entries(e.styles).map(([k, v]) => `${k}: ${v}`)
  const optional = [
    component,
    `${TEMPLATE.boundingBox}x=${Math.round(x)}, y=${Math.round(y)}, width=${Math.round(width)}, height=${Math.round(height)}`,
    e.screenshotPath ? TEMPLATE.screenshot + e.screenshotPath : undefined,
    e.text ? `${TEMPLATE.text}"${ellipsize(e.text, limits.textMaxChars)}"` : undefined,
    styles?.length ? TEMPLATE.styles + styles.join(TEMPLATE.stylesSeparator) : undefined,
  ]
  return optional.filter((l): l is string => l !== undefined).map(bullet)
}

function browserItem(c: FormattableComment, n: number, limits: FormatLimits): string[] {
  const e = c.element
  if (!e) return [`${n}. Browser element`]
  return [
    `${n}. Browser element ${code(e.selector)} on ${e.url}`,
    ...elementBullets(e, limits),
    ...outerHtmlLines(e, limits),
    ...consoleErrorLines(e.consoleErrors ?? [], limits),
  ]
}

function itemHead(c: FormattableComment, n: number, limits: FormatLimits): string[] {
  switch (c.source) {
    case COMMENT_SOURCE.editor:
    case COMMENT_SOURCE.diff:
      return codeItem(c, n, limits)
    case COMMENT_SOURCE.browser:
      return browserItem(c, n, limits)
    default: {
      const never: never = c.source
      throw new Error(`unknown comment source ${String(never)}`)
    }
  }
}

const formatItem = (c: FormattableComment, n: number, limits: FormatLimits): string =>
  [...itemHead(c, n, limits), ...indentLines(c.body.trim(), INDENT)].join(NEWLINE)

/** The text pasted into the agent: `Review comments:` and numbered items; `\n`, no trailing newline or spaces. */
export function formatComments(comments: readonly FormattableComment[], limits: FormatLimits = FORMAT_LIMITS): string {
  const items = comments.map((c, i) => formatItem(c, i + 1, limits)).join(TEMPLATE.itemSeparator)
  return `${TEMPLATE.header}${NEWLINE}${items}`.replace(TRAILING_SPACE_RE, '')
}
