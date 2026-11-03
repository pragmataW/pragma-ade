import {
  CHANGELOG_GROUPS,
  CONVENTIONAL,
  DRAFT_HEADER,
  EMPTY_DRAFT,
  LINK_REF,
  NEWLINE,
  REPO_URL,
  SECTION_HEADING,
  TAG_PREFIX,
  TYPE_GROUP,
  UNRELEASED,
} from './constants.ts'

type Group = (typeof CHANGELOG_GROUPS)[number]

const heading = (version: string): string => `${SECTION_HEADING}${version}]`
const isHeadingOf = (line: string, version: string): boolean =>
  line === heading(version) || line.startsWith(`${heading(version)} `)
const linkRef = (version: string): string => `[${version}]: ${REPO_URL}/releases/tag/${TAG_PREFIX}${version}`

/** Body of the `## [version]` section (without its heading), or undefined when absent. */
export function sectionBody(changelog: string, version: string): string | undefined {
  const lines = changelog.split(NEWLINE)
  const start = lines.findIndex((l) => isHeadingOf(l, version))
  if (start < 0) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => l.startsWith(SECTION_HEADING) || LINK_REF.test(l))
  return (end < 0 ? rest : rest.slice(0, end)).join(NEWLINE).trim()
}

/** Strips an optional `## [x]` heading and HTML comments from a notes file. */
export function cleanNotes(notes: string): string {
  return notes
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(NEWLINE)
    .filter((l) => !l.startsWith(SECTION_HEADING))
    .join(NEWLINE)
    .trim()
}

/**
 * Adds `## [version] - date` with `notes` above the newest section (or turns `## [Unreleased]` into it when
 * `notes` is empty) and its link reference above the newest one.
 */
export function insertSection(changelog: string, version: string, date: string, notes: string): string {
  if (sectionBody(changelog, version) !== undefined) throw new Error(`CHANGELOG already has ${heading(version)}`)
  const lines = changelog.split(NEWLINE)
  const title = `${heading(version)} - ${date}`
  const unreleased = lines.findIndex((l) => isHeadingOf(l, UNRELEASED))
  const body = cleanNotes(notes)
  if (unreleased >= 0 && body.length === 0) lines[unreleased] = title
  else {
    if (body.length === 0) throw new Error('release notes are empty')
    const at = lines.findIndex((l) => l.startsWith(SECTION_HEADING))
    lines.splice(at < 0 ? lines.length : at, 0, title, '', body, '')
  }
  const ref = lines.findIndex((l) => LINK_REF.test(l))
  if (ref < 0) lines.push(linkRef(version))
  else lines.splice(ref, 0, linkRef(version))
  return lines.join(NEWLINE)
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Groups Conventional Commit subjects into Added/Changed/Fixed bullets (a starting point, not the final text). */
export function draftNotes(subjects: readonly string[]): string {
  const groups = new Map<Group, string[]>()
  for (const subject of subjects) {
    const g = CONVENTIONAL.exec(subject.trim())?.groups
    const group = g ? TYPE_GROUP[g.type as keyof typeof TYPE_GROUP] : undefined
    if (!g || !group) continue
    const scope = g.scope ? `**${g.scope}:** ` : ''
    groups.set(group, [...(groups.get(group) ?? []), `- ${scope}${capitalize(g.text ?? '')}`])
  }
  const sections = CHANGELOG_GROUPS.flatMap((g) => {
    const items = groups.get(g)
    return items ? [`### ${g}`, '', ...items, ''] : []
  })
  return [DRAFT_HEADER, '', ...(sections.length > 0 ? sections : [EMPTY_DRAFT, ''])].join(NEWLINE)
}
