export const DEFAULT_ICON_PX = 16
export const DEFAULT_MONOGRAM_PX = 20
export const EMPTY_STATE_ICON_PX = 20
export const COPIED_FEEDBACK_MS = 1500
export const POPOVER_OFFSET_PX = 6
export const VIEWPORT_PADDING_PX = 8
export const FALLBACK_ICON = 'CircleHelp'
export const MONOGRAM_FONT_RATIO = 0.42
export const CLIPBOARD_COMMAND = 'copy'
export const BUTTON_TYPE = 'button'
export const PRIMARY_BUTTON_VARIANT = 'default'
export const SECONDARY_BUTTON_VARIANT = 'outline'

/** Languages bundled into the single Shiki highlighter (aliases resolve through the language modules). */
export const HIGHLIGHT_LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'md',
  'css',
  'html',
  'sh',
  'bash',
  'py',
  'go',
  'rust',
  'sql',
  'yaml',
  'diff',
] as const
export const PLAIN_LANG = 'text'
export const SHIKI_THEME_NAME = 'pragma'
export const SHIKI_VARIABLE_PREFIX = '--shiki-'
export const DEFAULT_TOKEN_COLOR = 'var(--tx)'
export const LANGUAGE_CLASS = /language-(?<lang>[\w-]+)/
