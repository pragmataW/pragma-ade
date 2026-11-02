import { GIT_DIR_PATHS, REF_PREFIXES, ROOT_HEAD_FILES } from '../constants'

export interface GitDirWorktreeRef {
  worktreeId: string
  isMain: boolean
  branch: string | null
  baseBranch: string
  /** Basename of a linked worktree's git dir (`<common>/worktrees/<name>`); null for the main checkout. */
  gitDirName: string | null
}

type Classified =
  | { kind: 'rootHead' }
  | { kind: 'linked'; name: string }
  | { kind: 'localRef'; branch: string }
  | { kind: 'remoteRef'; ref: string }
  | { kind: 'packedRefs' }
  | { kind: 'config' }
  | { kind: 'other' }

const ROOT_HEADS = new Set(ROOT_HEAD_FILES)
const KIND = {
  rootHead: 'rootHead',
  linked: 'linked',
  localRef: 'localRef',
  remoteRef: 'remoteRef',
  packedRefs: 'packedRefs',
  config: 'config',
  other: 'other',
} as const
const OTHER: Classified = { kind: KIND.other }
const REMOTE_SEPARATOR = '/'

/** `origin/feat` → `feat`: the local branch a remote-tracking ref usually is the upstream of. */
const remoteBranch = (ref: string): string => ref.slice(ref.indexOf(REMOTE_SEPARATOR) + 1)

function classify(path: string): Classified {
  if (ROOT_HEADS.has(path)) return { kind: KIND.rootHead }
  if (path === GIT_DIR_PATHS.packedRefs) return { kind: KIND.packedRefs }
  if (path === GIT_DIR_PATHS.config) return { kind: KIND.config }
  if (path.startsWith(GIT_DIR_PATHS.worktrees)) {
    const name = path.slice(GIT_DIR_PATHS.worktrees.length).split('/')[0] ?? ''
    return name ? { kind: KIND.linked, name } : OTHER
  }
  if (path.startsWith(REF_PREFIXES.heads)) return { kind: KIND.localRef, branch: path.slice(REF_PREFIXES.heads.length) }
  if (path.startsWith(REF_PREFIXES.remotes))
    return { kind: KIND.remoteRef, ref: path.slice(REF_PREFIXES.remotes.length) }
  return OTHER
}

function matches(c: Classified, r: GitDirWorktreeRef): boolean {
  switch (c.kind) {
    case KIND.rootHead:
      return r.isMain
    case KIND.linked:
      return r.gitDirName === c.name
    case KIND.localRef:
      return r.branch === c.branch
    case KIND.remoteRef:
      return r.baseBranch === c.ref || remoteBranch(c.ref) === r.branch
    case KIND.packedRefs:
    case KIND.config:
      return true
    case KIND.other:
      return false
    default: {
      const never: never = c
      return never
    }
  }
}

/** Worktree ids affected by a batch of changed paths relative to a repo's common git dir (unique, in ref order). */
export function mapGitDirPaths(relPaths: string[], refs: GitDirWorktreeRef[]): string[] {
  const kinds = relPaths.map(classify)
  return refs.filter((r) => kinds.some((c) => matches(c, r))).map((r) => r.worktreeId)
}
