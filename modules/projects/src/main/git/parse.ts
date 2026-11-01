import {
  NEWLINE,
  NUL,
  REF_PREFIXES,
  REMOTE_HEAD_SUFFIX,
  SPACE,
  STATUS_AB_RE,
  STATUS_DETACHED_HEAD,
  STATUS_HEADER_PREFIX,
  STATUS_HEADERS,
  STATUS_INITIAL_OID,
  STATUS_RECORD_FIELDS,
  UNTRACKED_XY,
  WORKTREE_ATTRS,
} from '../../constants'
import {
  type BranchInfo,
  GIT_STATUS_KINDS,
  type GitStatus,
  type GitStatusEntry,
  type GitStatusKind,
  type GitWorktreeEntry,
} from '../../contract'

type RecordTag = keyof typeof STATUS_RECORD_FIELDS
const [ORDINARY, RENAMED, UNMERGED, UNTRACKED] = GIT_STATUS_KINDS
const KIND_BY_TAG: Record<RecordTag, GitStatusKind> = { '1': ORDINARY, '2': RENAMED, u: UNMERGED, '?': UNTRACKED }
const XY_FIELD = 1

const isTag = (t: string): t is RecordTag => Object.hasOwn(STATUS_RECORD_FIELDS, t)

/** Splits off `n` space-separated fields; the rest of the line (which may contain spaces) is the path. */
function splitFields(line: string, n: number): { fields: string[]; rest: string } {
  const fields: string[] = []
  let at = 0
  for (let i = 0; i < n; i++) {
    const next = line.indexOf(SPACE, at)
    fields.push(line.slice(at, next))
    at = next + 1
  }
  return { fields, rest: line.slice(at) }
}

function applyHeader(status: GitStatus, header: string): void {
  const { fields, rest } = splitFields(header, 1)
  const [name] = fields
  if (name === STATUS_HEADERS.oid) status.oid = rest === STATUS_INITIAL_OID ? null : rest
  else if (name === STATUS_HEADERS.head) status.branch = rest === STATUS_DETACHED_HEAD ? null : rest
  else if (name === STATUS_HEADERS.upstream) status.upstream = rest
  else if (name === STATUS_HEADERS.ab) {
    const m = STATUS_AB_RE.exec(rest)
    status.ahead = m?.groups ? Number(m.groups.ahead) : null
    status.behind = m?.groups ? Number(m.groups.behind) : null
  }
}

function entryOf(tag: RecordTag, line: string): GitStatusEntry {
  const { fields, rest } = splitFields(line, STATUS_RECORD_FIELDS[tag])
  const kind = KIND_BY_TAG[tag]
  if (kind === UNTRACKED) return { kind, path: rest, index: UNTRACKED_XY, worktree: UNTRACKED_XY }
  const xy = fields[XY_FIELD] ?? ''
  return { kind, path: rest, index: xy.charAt(0), worktree: xy.charAt(1) }
}

/** Parses `git status --porcelain=v2 -z --branch --untracked-files=all`. `!` (ignored) records are skipped. */
export function parseStatusV2(out: string): GitStatus {
  const status: GitStatus = { branch: null, oid: null, upstream: null, ahead: null, behind: null, entries: [] }
  const tokens = out.split(NUL)
  for (let i = 0; i < tokens.length; i++) {
    const line = tokens[i] ?? ''
    if (line.startsWith(STATUS_HEADER_PREFIX)) {
      applyHeader(status, line.slice(STATUS_HEADER_PREFIX.length))
      continue
    }
    const tag = line.slice(0, line.indexOf(SPACE))
    if (!isTag(tag)) continue
    const entry = entryOf(tag, line)
    if (entry.kind === RENAMED) {
      i++
      entry.origPath = tokens[i] ?? ''
    }
    status.entries.push(entry)
  }
  return status
}

const emptyWorktree = (path: string): GitWorktreeEntry => ({
  path,
  head: null,
  branch: null,
  bare: false,
  detached: false,
  locked: false,
  prunable: false,
})

const stripPrefix = (ref: string, prefix: string): string => (ref.startsWith(prefix) ? ref.slice(prefix.length) : ref)

function applyWorktreeAttr(entry: GitWorktreeEntry, name: string, value: string): void {
  if (name === WORKTREE_ATTRS.head) entry.head = value
  else if (name === WORKTREE_ATTRS.branch) entry.branch = stripPrefix(value, REF_PREFIXES.heads)
  else if (name === WORKTREE_ATTRS.bare) entry.bare = true
  else if (name === WORKTREE_ATTRS.detached) entry.detached = true
  else if (name === WORKTREE_ATTRS.locked) entry.locked = true
  else if (name === WORKTREE_ATTRS.prunable) entry.prunable = true
}

/** Parses `git worktree list --porcelain -z` (records separated by an empty field). */
export function parseWorktreeList(out: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = []
  let current: GitWorktreeEntry | undefined
  for (const token of out.split(NUL)) {
    if (token === '') {
      current = undefined
      continue
    }
    const space = token.indexOf(SPACE)
    const name = space < 0 ? token : token.slice(0, space)
    const value = space < 0 ? '' : token.slice(space + 1)
    if (name === WORKTREE_ATTRS.worktree) {
      current = emptyWorktree(value)
      entries.push(current)
    } else if (current) applyWorktreeAttr(current, name, value)
  }
  return entries
}

function branchOf(ref: string, worktreePath: string): BranchInfo | null {
  const checkedOutAt = worktreePath === '' ? null : worktreePath
  if (ref.startsWith(REF_PREFIXES.heads))
    return { name: ref.slice(REF_PREFIXES.heads.length), kind: 'local', checkedOutAt }
  if (!ref.startsWith(REF_PREFIXES.remotes) || ref.endsWith(REMOTE_HEAD_SUFFIX)) return null
  return { name: ref.slice(REF_PREFIXES.remotes.length), kind: 'remote', checkedOutAt }
}

/** Parses `git for-each-ref --format=%(refname)%00%(worktreepath)%00 refs/heads refs/remotes`. */
export function parseBranchList(out: string): BranchInfo[] {
  return out
    .split(NEWLINE)
    .filter((line) => line.length > 0)
    .map((line) => {
      const [ref = '', worktreePath = ''] = line.split(NUL)
      return branchOf(ref, worktreePath)
    })
    .filter((b): b is BranchInfo => b !== null)
}
