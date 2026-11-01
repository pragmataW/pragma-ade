import { type ChangedFile, FILE_STATUS, type FileStatus } from '../contract'

/** One `--name-status -z` record. */
export interface NameStatusEntry {
  status: FileStatus
  path: string
  oldPath?: string
}
export interface LineCounts {
  additions: number
  deletions: number
  binary: boolean
}

const NUL = '\0'
const TAB = '\t'
const NEWLINE = '\n'
const BINARY_COUNT = '-'
const RENAME = 'R'
const COPY = 'C'
/** Tokens per record: status + path, status + old + new; numstat: counts+path, counts + old + new. */
const PATH_RECORD = 2
const PAIR_RECORD = 3
/** Single-path git status letters → our statuses; `T` (type change) and `U` (unmerged) read as modified. */
const SINGLE_PATH_STATUS: Record<string, FileStatus> = {
  A: FILE_STATUS.A,
  M: FILE_STATUS.M,
  D: FILE_STATUS.D,
  T: FILE_STATUS.M,
  U: FILE_STATUS.M,
}

/** Splits `-z` output into its tokens (the trailing NUL leaves no empty token). */
const tokens = (out: string): string[] => {
  const parts = out.split(NUL)
  if (parts.at(-1) === '') parts.pop()
  return parts
}

/** `X\0path\0` or `R087\0old\0new\0` / `C100\0src\0dst\0` (a copy lists the new path as added). */
export function parseNameStatusZ(out: string): NameStatusEntry[] {
  const parts = tokens(out)
  const entries: NameStatusEntry[] = []
  let i = 0
  while (i < parts.length) {
    const letter = (parts[i] ?? '').charAt(0)
    if (letter === RENAME || letter === COPY) {
      const oldPath = parts[i + 1] ?? ''
      const path = parts[i + PATH_RECORD] ?? ''
      entries.push(letter === RENAME ? { status: FILE_STATUS.R, path, oldPath } : { status: FILE_STATUS.A, path })
      i += PAIR_RECORD
      continue
    }
    entries.push({ status: SINGLE_PATH_STATUS[letter] ?? FILE_STATUS.M, path: parts[i + 1] ?? '' })
    i += PATH_RECORD
  }
  return entries
}

const toCount = (raw: string): number => (raw === BINARY_COUNT ? 0 : Number(raw))

/** `a\td\tpath\0`, or `a\td\t\0old\0new\0` for renames (keyed by the new path); `-\t-` = binary. */
export function parseNumstatZ(out: string): Map<string, LineCounts> {
  const parts = tokens(out)
  const counts = new Map<string, LineCounts>()
  let i = 0
  while (i < parts.length) {
    const [added = '', deleted = '', inlinePath = ''] = (parts[i] ?? '').split(TAB)
    const renamed = inlinePath === ''
    const path = renamed ? (parts[i + PATH_RECORD] ?? '') : inlinePath
    counts.set(path, {
      additions: toCount(added),
      deletions: toCount(deleted),
      binary: added === BINARY_COUNT && deleted === BINARY_COUNT,
    })
    i += renamed ? PAIR_RECORD : 1
  }
  return counts
}

/** Code-unit order, the order git itself lists paths in (`README.md` before `assets/`). */
export const comparePaths = (a: string, b: string): number => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Name-status entries with their line counts (0/0 when numstat has none), sorted by path. */
export function mergeChanges(nameStatus: NameStatusEntry[], numstat: Map<string, LineCounts>): ChangedFile[] {
  return nameStatus
    .map((e) => ({ ...e, ...(numstat.get(e.path) ?? { additions: 0, deletions: 0, binary: false }) }))
    .sort((a, b) => comparePaths(a.path, b.path))
}

/** Lines of a text; a trailing newline does not start another line. */
export function countLines(text: string): number {
  if (text === '') return 0
  const breaks = text.split(NEWLINE).length - 1
  return text.endsWith(NEWLINE) ? breaks : breaks + 1
}
