import { z } from '@pragma/sdk'
import {
  BACKSLASH_RE,
  DOT_SLASH_RE,
  DRIVE_PATH_RE,
  FILE_EXTENSION_RE,
  FILE_REF_ANCHOR_RE,
  FILE_REF_LINE_COL_RE,
  NEWLINE,
  PARENT_SEGMENT,
  PATH_SEPARATOR,
  URL_SCHEME_RE,
} from '../../constants'

export const fileRefSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
})
export type FileRef = z.infer<typeof fileRefSchema>

const slashes = (p: string): string => p.replace(BACKSLASH_RE, PATH_SEPARATOR)
const isAbsolute = (p: string): boolean => p.startsWith(PATH_SEPARATOR) || DRIVE_PATH_RE.test(p)

/** `path`, `line`, `column` from the `:line:col` / `#L12` suffix (a 0 line is no reference). */
function splitPosition(raw: string): { path: string; line?: number; column?: number } | null {
  const anchor = FILE_REF_ANCHOR_RE.exec(raw)
  const m = anchor ?? FILE_REF_LINE_COL_RE.exec(raw)
  if (!m) return { path: raw }
  const line = Number(m.groups?.line)
  const column = m.groups?.col ? Number(m.groups.col) : undefined
  if (line < 1 || column === 0) return null
  return { path: raw.slice(0, m.index), line, ...(column ? { column } : {}) }
}

/** The worktree-relative path, or null when it is outside the worktree. */
function relativePath(path: string, worktreePath: string): string | null {
  if (!isAbsolute(path)) return path.replace(DOT_SLASH_RE, '')
  const root = slashes(worktreePath).replace(/\/+$/, '')
  const prefix = `${root}${PATH_SEPARATOR}`
  const caseless = DRIVE_PATH_RE.test(root)
  const matches = caseless ? path.toLowerCase().startsWith(prefix.toLowerCase()) : path.startsWith(prefix)
  return matches ? path.slice(prefix.length) : null
}

/** A link only for in-worktree file paths (no URLs, no `..`, no bare words like `README`). */
export function parseFileRef(raw: string, worktreePath: string): FileRef | null {
  const text = slashes(raw.trim())
  if (!text || text.includes(NEWLINE) || URL_SCHEME_RE.test(text)) return null
  const pos = splitPosition(text)
  const path = pos ? relativePath(pos.path, worktreePath) : null
  if (!pos || !path) return null
  const segments = path.split(PATH_SEPARATOR)
  const last = segments.at(-1) ?? ''
  if (segments.includes(PARENT_SEGMENT) || !FILE_EXTENSION_RE.test(last)) return null
  return { ...pos, path }
}
