import { join } from 'node:path'
import { slugify } from '@pragma/sdk'
import {
  BRANCH_SLUG_FALLBACK,
  BRANCH_SLUG_MAX_LENGTH,
  DEDUPE_FIRST_SUFFIX,
  DEDUPE_SEPARATOR,
  HOME_PREFIX_RE,
  PROJECT_SLUG_FALLBACK,
} from '../constants'

const slug = (text: string, fallback: string): string =>
  slugify(text, { maxLength: BRANCH_SLUG_MAX_LENGTH }) || fallback

/** Folder name for a branch: `feat/Login Page` → `feat-login-page`. */
export const branchSlug = (branch: string): string => slug(branch, BRANCH_SLUG_FALLBACK)
export const projectSlug = (name: string): string => slug(name, PROJECT_SLUG_FALLBACK)

/** Expands a leading `~`, `~/` or `~\` to `home`. */
export function expandHome(p: string, home: string): string {
  if (!HOME_PREFIX_RE.test(p)) return p
  const rest = p.replace(HOME_PREFIX_RE, '')
  return rest ? join(home, rest) : home
}

/** `<root>/<project-slug>/<branch-slug>`, suffixed `-2`, `-3`, … while the path exists. */
export function defaultWorktreePath(o: {
  root: string
  projectName: string
  branch: string
  home: string
  exists: (p: string) => boolean
}): string {
  const base = join(expandHome(o.root, o.home), projectSlug(o.projectName), branchSlug(o.branch))
  let candidate = base
  for (let n = DEDUPE_FIRST_SUFFIX; o.exists(candidate); n++) candidate = `${base}${DEDUPE_SEPARATOR}${n}`
  return candidate
}
