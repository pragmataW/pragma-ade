import type { GitStatus } from '@pragma/module-projects/contract'

const NUL = '\0'
const HEADER = '# branch.'
const SPACE = ' '
const INITIAL = '(initial)'
const DETACHED = '(detached)'
const AB_RE = /^\+(\d+) -(\d+)$/

type Apply = (status: GitStatus, value: string) => void
const HEADERS: Record<string, Apply> = {
  oid: (s, v) => {
    s.oid = v === INITIAL ? null : v
  },
  head: (s, v) => {
    s.branch = v === DETACHED ? null : v
  },
  upstream: (s, v) => {
    s.upstream = v
  },
  ab: (s, v) => {
    const m = AB_RE.exec(v)
    s.ahead = m ? Number(m[1]) : null
    s.behind = m ? Number(m[2]) : null
  },
}

/** The `# branch.*` headers of `git status --porcelain=v2 -z --branch` (test port: entries are not parsed). */
export function parseBranchHeaders(out: string): GitStatus {
  const status: GitStatus = { branch: null, oid: null, upstream: null, ahead: null, behind: null, entries: [] }
  for (const token of out.split(NUL)) {
    if (!token.startsWith(HEADER)) continue
    const [name = '', ...rest] = token.slice(HEADER.length).split(SPACE)
    HEADERS[name]?.(status, rest.join(SPACE))
  }
  return status
}
