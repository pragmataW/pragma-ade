import { slugify } from '@pragma/sdk'
import {
  BRANCH_PREFIX,
  FALLBACK_KEY_PREFIX,
  KEY_PREFIX_LENGTH,
  NON_SLUG_CHARS_RE,
  PROMPT_SEPARATOR,
  SLUG_MAX_CHARS,
  SLUG_SEPARATOR,
} from '../constants'

/** First letters/digits of the project name, upper-cased (`pragma-ade` → `PRA`); `TSK` when there are none. */
export function keyPrefixFor(projectName: string): string {
  const letters = slugify(projectName).replace(NON_SLUG_CHARS_RE, '').slice(0, KEY_PREFIX_LENGTH)
  return letters ? letters.toUpperCase() : FALLBACK_KEY_PREFIX
}

/** The title slug capped at `SLUG_MAX_CHARS`, cut back to a hyphen when the cap falls inside a word. */
function cappedSlug(title: string): string {
  const cut = slugify(title, { maxLength: SLUG_MAX_CHARS })
  const longer = slugify(title, { maxLength: SLUG_MAX_CHARS + 1 })
  const midWord = longer.length > cut.length && longer[cut.length] !== SLUG_SEPARATOR
  const lastHyphen = cut.lastIndexOf(SLUG_SEPARATOR)
  return midWord && lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut
}

/** `feat/<key>-<slug>` (§10.3); `feat/<key>` when the title has no slug (emoji only). */
export function deriveBranchName(key: string, title: string): string {
  const base = `${BRANCH_PREFIX}${key.toLowerCase()}`
  const slug = cappedSlug(title)
  return slug ? `${base}${SLUG_SEPARATOR}${slug}` : base
}

/** The fixed English prompt sent to an agent: title, then the description when present. */
export function buildTaskPrompt(task: { title: string; descriptionMd: string }): string {
  const title = task.title.trim()
  const description = task.descriptionMd.trim()
  return description ? `${title}${PROMPT_SEPARATOR}${description}` : title
}
