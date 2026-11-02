import { FILE_CHANGE, type FileEditHunk } from '@pragma/module-chat/contract'
import { HUNK_HEADER_RE, LINE_PREFIX, NEWLINE, NO_NEWLINE_MARKER } from '../constants'
import type { FileDiff } from '../schemas'

type Side = { before: string[]; after: string[] }

function addLine(h: Side, line: string): void {
  const prefix = line.charAt(0)
  const text = line.slice(1)
  if (prefix === LINE_PREFIX.removed) h.before.push(text)
  else if (prefix === LINE_PREFIX.added) h.after.push(text)
  else if (prefix !== NO_NEWLINE_MARKER) {
    h.before.push(text)
    h.after.push(text)
  }
}

/** One hunk per `@@` block: `before` = context + removed lines, `after` = context + added lines (no prefixes). */
export function patchToHunks(patch: string): FileEditHunk[] {
  const lines = patch.split(NEWLINE)
  if (lines.at(-1) === '') lines.pop()
  const hunks: Side[] = []
  for (const line of lines) {
    if (HUNK_HEADER_RE.test(line)) hunks.push({ before: [], after: [] })
    else {
      const current = hunks.at(-1)
      if (current) addLine(current, line)
    }
  }
  return hunks.map((h) => ({ before: h.before.join(NEWLINE), after: h.after.join(NEWLINE) }))
}

const CHANGES = { modified: FILE_CHANGE.edit, added: FILE_CHANGE.create, deleted: FILE_CHANGE.delete } as const

/** OpenCode file status → chat file change. */
export const changeOf = (status: FileDiff['status']) => CHANGES[status]
