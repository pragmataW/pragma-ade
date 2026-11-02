import type { HunkInfo } from '../contract'

/** One hunk of a single-file unified diff: its parsed `@@` header and its raw lines (header included). */
export interface ParsedHunk extends HunkInfo {
  lines: string[]
}

/** A single-file unified diff: the file header lines (`diff --git`, `index`, `---`, `+++`…) and the hunks. */
export interface ParsedFilePatch {
  head: string[]
  hunks: ParsedHunk[]
}

const NEWLINE = '\n'
const HUNK_PREFIX = '@@ -'
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
/** A range without `,count` spans one line. */
const DEFAULT_COUNT = '1'

/** Splits on LF only: a CRLF line keeps its `\r` (git apply needs the exact bytes); the final newline ends a line. */
function splitLines(diff: string): string[] {
  const lines = diff.split(NEWLINE)
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function parseHeader(line: string): HunkInfo | null {
  const m = HUNK_HEADER_RE.exec(line)
  if (!m) return null
  const [header = '', oldStart = '', oldLines = DEFAULT_COUNT, newStart = '', newLines = DEFAULT_COUNT] = m
  return {
    header,
    oldStart: Number(oldStart),
    oldLines: Number(oldLines),
    newStart: Number(newStart),
    newLines: Number(newLines),
  }
}

/**
 * Parses `git diff` output for one file. Content lines start with ` `, `+`, `-` or `\` ("No newline at end of
 * file", kept with its hunk), so only a hunk header starts with `@@ -`.
 */
export function parseFilePatch(diff: string): ParsedFilePatch {
  const patch: ParsedFilePatch = { head: [], hunks: [] }
  for (const line of splitLines(diff)) {
    const info = line.startsWith(HUNK_PREFIX) ? parseHeader(line) : null
    const current = patch.hunks.at(-1)
    if (info) patch.hunks.push({ ...info, lines: [line] })
    else if (current) current.lines.push(line)
    else patch.head.push(line)
  }
  return patch
}

/** The hunks of a diff without their lines (what the renderer lists). */
export const hunksOf = (diff: string): HunkInfo[] =>
  parseFilePatch(diff).hunks.map(({ lines: _lines, ...info }) => info)

/**
 * A patch holding the file header and the one hunk whose `@@ -a,b +c,d @@` range equals `header`; null when the diff
 * no longer has it (the file changed since the renderer listed its hunks). Fed to `git apply [--cached] [-R]`.
 */
export function singleHunkPatch(diff: string, header: string): string | null {
  const { head, hunks } = parseFilePatch(diff)
  const hunk = hunks.find((h) => h.header === header)
  if (!hunk || head.length === 0) return null
  return [...head, ...hunk.lines, ''].join(NEWLINE)
}
