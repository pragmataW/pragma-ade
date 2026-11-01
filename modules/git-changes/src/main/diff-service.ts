import * as nodeFs from 'node:fs/promises'
import type { GitService } from '@pragma/module-projects/contract'
import { EMPTY_TREE_SHA, GIT_FLAGS } from '../constants'
import {
  CHANGE_LIST_STATE,
  CHANGE_MODE,
  type ChangedFile,
  type ChangeList,
  type ChangeMode,
  FILE_STATUS,
  FILE_VERSION_KIND,
  type OkChangeList,
} from '../contract'
import { comparePaths, countLines, mergeChanges, parseNameStatusZ, parseNumstatZ } from './parse'
import { readDiskSide, resolveInside, sniffFile } from './read-side'

export type GitPort = Pick<GitService, 'run' | 'mergeBase' | 'show' | 'countCommits'>
export type FsPort = Pick<typeof nodeFs, 'lstat' | 'readFile' | 'open'>

export interface DiffServiceDeps {
  git: GitPort
  maxFileBytes(): number
  fs?: FsPort
}
export interface ListChangesInput {
  worktreeId: string
  cwd: string
  mode: ChangeMode
  baseBranch: string
}

const HEAD = 'HEAD'
const COMMIT_PEEL = '^{commit}'
const ALLOW = { allowFailure: true } as const
const GIT_ARGS = {
  verify: ['rev-parse', '--verify', '-q'],
  diff: ['diff', '--no-color', '--no-ext-diff', '-M', '-z'],
  nameStatus: '--name-status',
  numstat: '--numstat',
  untracked: ['ls-files', '--others', '--exclude-standard', '-z'],
  endOfRevs: '--',
} as const
const NUL = '\0'

type ListHeader = Pick<ChangeList, 'worktreeId' | 'mode' | 'baseBranch'>
type MissingBaseState = Exclude<ChangeList['state'], typeof CHANGE_LIST_STATE.ok>

/** Turns git output into the change-list and file-contents DTOs (main side). */
export class DiffService {
  readonly #git: GitPort
  readonly #max: () => number
  readonly #fs: FsPort

  constructor(deps: DiffServiceDeps) {
    this.#git = deps.git
    this.#max = deps.maxFileBytes
    this.#fs = deps.fs ?? nodeFs
  }

  async listChanges(input: ListChangesInput): Promise<ChangeList> {
    const header: ListHeader = { worktreeId: input.worktreeId, mode: input.mode, baseBranch: input.baseBranch }
    const head = await this.resolveRev(input.cwd, HEAD)
    switch (input.mode) {
      case CHANGE_MODE.uncommitted:
        return this.listUncommitted(input.cwd, header, head)
      case CHANGE_MODE.branch:
        return this.listBranch(input.cwd, header, head)
      default: {
        const never: never = input.mode
        throw new Error(`unknown mode ${String(never)}`)
      }
    }
  }

  /** `HEAD` / `<base>^{commit}` as a sha, or null when it does not resolve. */
  protected async resolveRev(cwd: string, rev: string): Promise<string | null> {
    const r = await this.git(cwd, [...GIT_ARGS.verify, rev === HEAD ? HEAD : `${rev}${COMMIT_PEEL}`], true)
    return r.exitCode === 0 ? r.stdout.trim() : null
  }

  /** The merge-base of `base` and HEAD, or the list state that explains why there is none. */
  protected async branchBase(
    cwd: string,
    base: string,
  ): Promise<{ found: true; mergeBase: string } | { found: false; state: MissingBaseState }> {
    if (!(await this.resolveRev(cwd, base))) return { found: false, state: CHANGE_LIST_STATE.baseNotFound }
    const mergeBase = await this.#git.mergeBase(cwd, base, HEAD)
    return mergeBase ? { found: true, mergeBase } : { found: false, state: CHANGE_LIST_STATE.noMergeBase }
  }

  protected git(cwd: string, args: readonly string[], allowFailure = false) {
    return this.#git.run(cwd, [...GIT_FLAGS, ...args], allowFailure ? ALLOW : {})
  }

  private async listUncommitted(cwd: string, header: ListHeader, head: string | null): Promise<ChangeList> {
    const [tracked, untracked] = await Promise.all([
      this.diffFiles(cwd, [head ?? EMPTY_TREE_SHA]),
      this.untrackedFiles(cwd),
    ])
    const files = [...tracked, ...untracked].sort((a, b) => comparePaths(a.path, b.path))
    return okList(header, { mergeBase: null, headSha: head, commitCount: null, files })
  }

  private async listBranch(cwd: string, header: ListHeader, head: string | null): Promise<ChangeList> {
    const base = await this.branchBase(cwd, header.baseBranch)
    if (!base.found) return { state: base.state, ...header }
    const [files, commitCount] = await Promise.all([
      this.diffFiles(cwd, [base.mergeBase, HEAD]),
      this.#git.countCommits(cwd, base.mergeBase, HEAD),
    ])
    return okList(header, { mergeBase: base.mergeBase, headSha: head, commitCount, files })
  }

  private async diffFiles(cwd: string, revs: string[]): Promise<ChangedFile[]> {
    const diff = (format: string) => this.git(cwd, [...GIT_ARGS.diff, format, ...revs, GIT_ARGS.endOfRevs])
    const [nameStatus, numstat] = await Promise.all([diff(GIT_ARGS.nameStatus), diff(GIT_ARGS.numstat)])
    return mergeChanges(parseNameStatusZ(nameStatus.stdout), parseNumstatZ(numstat.stdout))
  }

  private async untrackedFiles(cwd: string): Promise<ChangedFile[]> {
    const out = (await this.git(cwd, GIT_ARGS.untracked)).stdout
    const paths = out.split(NUL).filter((p) => p !== '')
    const files = await Promise.all(paths.map((p) => this.inspectUntracked(cwd, p)))
    return files.filter((f): f is ChangedFile => f !== null)
  }

  /** Directories (nested repositories) and files that vanished are skipped; additions = lines of a text file. */
  private async inspectUntracked(cwd: string, path: string): Promise<ChangedFile | null> {
    const abs = resolveInside(cwd, path)
    const stat = await this.#fs.lstat(abs).catch(() => null)
    if (!stat || stat.isDirectory()) return null
    const file = { path, status: FILE_STATUS.U, additions: 0, deletions: 0, binary: false }
    const version = await readDiskSide(this.#fs, cwd, path, this.#max())
    switch (version.kind) {
      case FILE_VERSION_KIND.text:
        return { ...file, additions: countLines(version.contents) }
      case FILE_VERSION_KIND.binary:
        return { ...file, binary: true }
      case FILE_VERSION_KIND.tooLarge:
        return { ...file, binary: await sniffFile(this.#fs, abs) }
      case FILE_VERSION_KIND.unreadable:
        return file
      case FILE_VERSION_KIND.absent:
        return null
      default: {
        const never: never = version
        throw new Error(`unknown version ${String(never)}`)
      }
    }
  }
}

function okList(
  header: ListHeader,
  rest: Pick<OkChangeList, 'mergeBase' | 'headSha' | 'commitCount' | 'files'>,
): OkChangeList {
  const totals = rest.files.reduce(
    (t, f) => ({ files: t.files + 1, additions: t.additions + f.additions, deletions: t.deletions + f.deletions }),
    { files: 0, additions: 0, deletions: 0 },
  )
  return { state: CHANGE_LIST_STATE.ok, ...header, ...rest, totals }
}
