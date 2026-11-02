import type { GitRunOptions, GitRunResult, GitService } from '@pragma/module-projects/contract'
import { GIT_FLAGS, NETWORK_TIMEOUT_MS } from '../constants'
import {
  type ApplyHunkInput,
  type CommitInput,
  DESTRUCTIVE_REASONS,
  type DestructiveReason,
  type DestructiveSnapshot,
  HUNK_ACTIONS,
  type HunkAction,
  type HunkInfo,
  type RemoteAction,
  type ScmResult,
  type ScmState,
  STASH_ACTIONS,
  type StashAction,
  type StashEntry,
  type StashPushInput,
} from '../contract'
import type { DestructiveHooks } from './destructive-hooks'
import { hunksOf, singleHunkPatch } from './patch'
import { classifyFailure, OK, scmFailure } from './scm-errors'

export type ScmGitPort = Pick<GitService, 'run' | 'status'>

export interface ScmServiceDeps {
  git: ScmGitPort
  hooks: Pick<DestructiveHooks, 'run'>
  /** `git-changes.pullRebase`: Pull and Sync rebase instead of merging. */
  pullRebase(): boolean
  /** Called after every operation that may have changed the worktree, index, refs or stashes. */
  onChanged(worktreeId: string): void
}

/** Which worktree an operation runs in (its id for events, its path for git). */
export interface ScmTarget {
  worktreeId: string
  cwd: string
}

const ARGS = {
  addAll: ['add', '-A'],
  restoreStaged: ['restore', '--staged'],
  resetIndex: ['reset', '-q'],
  rmCached: ['rm', '--cached', '-r', '-q', '--ignore-unmatch'],
  restoreWorktree: ['restore', '--worktree'],
  clean: ['clean', '-f', '-q'],
  untracked: ['ls-files', '--others', '--exclude-standard', '-z'],
  unstagedNames: ['diff', '--name-only', '-z'],
  diff: ['diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--unified=3'],
  cached: '--cached',
  apply: ['apply', '--whitespace=nowarn'],
  stdin: '-',
  commit: ['commit', '--quiet'],
  amend: '--amend',
  signoff: '--signoff',
  noEdit: '--no-edit',
  messageFromStdin: ['-F', '-'],
  verifyHead: ['rev-parse', '--verify', '-q', 'HEAD'],
  verifyParent: ['rev-parse', '--verify', '-q', 'HEAD~1'],
  resetSoft: ['reset', '--soft', 'HEAD~1'],
  deleteHead: ['update-ref', '-d', 'HEAD'],
  stashList: ['stash', 'list', '--format=%H%x09%gs'],
  stashPush: ['stash', 'push'],
  includeUntracked: '--include-untracked',
  stagedOnly: '--staged',
  message: '-m',
  stash: 'stash',
  stashClear: ['stash', 'clear'],
  fetch: ['fetch', '--prune'],
  pull: 'pull',
  rebase: '--rebase',
  noRebase: '--no-rebase',
  push: 'push',
  setUpstream: '-u',
  remotes: ['remote'],
  endOfOptions: '--',
} as const
const HUNK_APPLY_FLAGS: Record<HunkAction, string[]> = {
  stage: ['--cached'],
  unstage: ['--cached', '-R'],
  discard: ['-R'],
}
const [, UNSTAGE_HUNK, DISCARD_HUNK] = HUNK_ACTIONS
const [, , DROP] = STASH_ACTIONS
const [DISCARD, DISCARD_HUNK_REASON, DISCARD_ALL, CLEAN_UNTRACKED, STASH_DROP, STASH_CLEAR, UNDO_COMMIT] =
  DESTRUCTIVE_REASONS
const ORIGIN = 'origin'
const NUL = '\0'
const NEWLINE = '\n'
const TAB = '\t'
const STASH_REF = (index: number) => `stash@{${index}}`
const NO_LOCAL_CHANGES_RE = /No local changes to save/
/** Paths are names, not pathspecs (`*.txt`, `:/` match only themselves). */
const LITERAL: GitRunOptions = { allowFailure: true, env: { GIT_LITERAL_PATHSPECS: '1' } }
const LOCAL: GitRunOptions = { allowFailure: true }
/** Network calls never prompt (credential errors surface as `authFailed`) and get a longer timeout. */
const NETWORK: GitRunOptions = {
  allowFailure: true,
  timeoutMs: NETWORK_TIMEOUT_MS,
  env: { GIT_TERMINAL_PROMPT: '0' },
}

/** `args` when `on`, else nothing. */
const flag = (on: boolean, ...args: string[]): string[] => (on ? args : [])
const commitArgs = (input: CommitInput, hasMessage: boolean): string[] => [
  ...ARGS.commit,
  ...flag(input.amend, ARGS.amend),
  ...flag(input.signoff, ARGS.signoff),
  ...(hasMessage ? ARGS.messageFromStdin : [ARGS.noEdit]),
]
const splitZ = (out: string): string[] => out.split(NUL).filter((p) => p !== '')
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** VS Code's Source Control operations on one worktree, serialized per repository; git failures become results. */
export class ScmService {
  readonly #git: ScmGitPort
  readonly #hooks: ScmServiceDeps['hooks']
  readonly #pullRebase: () => boolean
  readonly #onChanged: (worktreeId: string) => void
  readonly #tails = new Map<string, Promise<unknown>>()
  readonly #remoteOps: Record<RemoteAction, (cwd: string) => Promise<ScmResult>> = {
    fetch: (cwd) => this.result(cwd, ARGS.fetch, NETWORK),
    pull: (cwd) => this.pull(cwd, this.#pullRebase()),
    pullRebase: (cwd) => this.pull(cwd, true),
    push: (cwd) => this.push(cwd),
    sync: (cwd) => this.sync(cwd),
  }

  constructor(deps: ScmServiceDeps) {
    this.#git = deps.git
    this.#hooks = deps.hooks
    this.#pullRebase = deps.pullRebase
    this.#onChanged = deps.onChanged
  }

  async state(cwd: string): Promise<ScmState> {
    const s = await this.#git.status(cwd)
    return {
      branch: s.branch,
      upstream: s.upstream,
      ahead: s.ahead ?? 0,
      behind: s.behind ?? 0,
      hasHead: s.oid !== null,
    }
  }

  async hunks(cwd: string, path: string, staged: boolean): Promise<HunkInfo[]> {
    return hunksOf(await this.diffText(cwd, path, staged))
  }

  async stashes(cwd: string): Promise<StashEntry[]> {
    const r = await this.exec(cwd, ARGS.stashList, LOCAL)
    if (r.exitCode !== 0) return []
    return r.stdout
      .split(NEWLINE)
      .filter((l) => l !== '')
      .map((line, index) => {
        const tab = line.indexOf(TAB)
        return { index, sha: line.slice(0, tab), message: line.slice(tab + 1) }
      })
  }

  /** `add -A` of the paths, or of everything. */
  stage(t: ScmTarget, paths?: string[]): Promise<ScmResult> {
    return this.mutate(t, () =>
      paths
        ? this.result(t.cwd, [...ARGS.addAll, ARGS.endOfOptions, ...paths], LITERAL)
        : this.result(t.cwd, ARGS.addAll),
    )
  }

  /** Index back to HEAD for the paths (or all); without commits the paths leave the index. */
  unstage(t: ScmTarget, paths?: string[]): Promise<ScmResult> {
    return this.mutate(t, async () => {
      if (!(await this.hasHead(t.cwd)))
        return this.result(t.cwd, [...ARGS.rmCached, ARGS.endOfOptions, ...(paths ?? ['.'])], LITERAL)
      if (!paths) return this.result(t.cwd, ARGS.resetIndex)
      return this.result(t.cwd, [...ARGS.restoreStaged, ARGS.endOfOptions, ...paths], LITERAL)
    })
  }

  /** Tracked paths back to their index version, untracked ones deleted; all = every unstaged change. */
  discard(t: ScmTarget, paths?: string[]): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const untracked = await this.untracked(t.cwd, paths)
      const tracked = paths ? paths.filter((p) => !untracked.includes(p)) : await this.unstagedTracked(t.cwd)
      await this.snapshot(t, discardReason(paths, tracked), { paths: [...tracked, ...untracked] })
      if (tracked.length > 0) {
        const restored = await this.result(t.cwd, [...ARGS.restoreWorktree, ARGS.endOfOptions, ...tracked], LITERAL)
        if (!restored.ok) return restored
      }
      if (untracked.length === 0) return OK
      return this.result(t.cwd, [...ARGS.clean, ARGS.endOfOptions, ...untracked], LITERAL)
    })
  }

  /** One hunk (named by its `@@` range) staged, unstaged or discarded through `git apply`. */
  applyHunk(t: ScmTarget, input: ApplyHunkInput): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const diff = await this.diffText(t.cwd, input.path, input.action === UNSTAGE_HUNK)
      const patch = singleHunkPatch(diff, input.header)
      if (patch === null) return scmFailure('hunkStale')
      if (input.action === DISCARD_HUNK) await this.snapshot(t, DISCARD_HUNK_REASON, { paths: [input.path] })
      const args = [...ARGS.apply, ...HUNK_APPLY_FLAGS[input.action], ARGS.stdin]
      return this.result(t.cwd, args, { ...LOCAL, input: patch })
    })
  }

  /** `commit -F -`; amend without a message keeps the old one; `stageAll` = smart commit. */
  commit(t: ScmTarget, input: CommitInput): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const hasMessage = input.message.trim() !== ''
      if (!hasMessage && !input.amend) return scmFailure('emptyMessage')
      if (input.stageAll) {
        const staged = await this.result(t.cwd, ARGS.addAll)
        if (!staged.ok) return staged
      }
      return this.result(t.cwd, commitArgs(input, hasMessage), hasMessage ? { ...LOCAL, input: input.message } : LOCAL)
    })
  }

  /** `reset --soft HEAD~1`; the first commit is undone by deleting HEAD (its files stay staged). */
  undoCommit(t: ScmTarget): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const head = await this.stdout(t.cwd, ARGS.verifyHead)
      if (head === null) return scmFailure('gitFailed')
      await this.snapshot(t, UNDO_COMMIT, { headSha: head })
      const parent = await this.stdout(t.cwd, ARGS.verifyParent)
      return this.result(t.cwd, parent === null ? ARGS.deleteHead : ARGS.resetSoft)
    })
  }

  stashPush(t: ScmTarget, input: StashPushInput): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const message = input.message.trim()
      const args = [
        ...ARGS.stashPush,
        ...flag(input.includeUntracked, ARGS.includeUntracked),
        ...flag(input.staged, ARGS.stagedOnly),
        ...flag(message !== '', ARGS.message, message),
      ]
      const r = await this.exec(t.cwd, args, LOCAL)
      if (NO_LOCAL_CHANGES_RE.test(r.stdout + r.stderr)) return scmFailure('nothingToStash')
      return toResult(r)
    })
  }

  /** apply / pop / drop of the stash with this commit sha. */
  stash(t: ScmTarget, input: { action: StashAction; sha: string }): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const entry = (await this.stashes(t.cwd)).find((s) => s.sha === input.sha)
      if (!entry) return scmFailure('stashNotFound')
      if (input.action === DROP) await this.snapshot(t, STASH_DROP, { stashes: [entry] })
      return this.result(t.cwd, [ARGS.stash, input.action, STASH_REF(entry.index)])
    })
  }

  stashClear(t: ScmTarget): Promise<ScmResult> {
    return this.mutate(t, async () => {
      const stashes = await this.stashes(t.cwd)
      if (stashes.length === 0) return OK
      await this.snapshot(t, STASH_CLEAR, { stashes })
      return this.result(t.cwd, ARGS.stashClear)
    })
  }

  remote(t: ScmTarget, action: RemoteAction): Promise<ScmResult> {
    return this.mutate(t, () => this.#remoteOps[action](t.cwd))
  }

  private pull(cwd: string, rebase: boolean): Promise<ScmResult> {
    return this.result(cwd, [ARGS.pull, rebase ? ARGS.rebase : ARGS.noRebase], NETWORK)
  }

  /** `push`, or `push -u <origin|first remote> <branch>` to publish a branch without upstream. */
  private async push(cwd: string): Promise<ScmResult> {
    const { branch, upstream } = await this.#git.status(cwd)
    if (upstream) return this.result(cwd, [ARGS.push], NETWORK)
    if (!branch) return scmFailure('detachedHead')
    const remote = await this.defaultRemote(cwd)
    if (!remote) return scmFailure('noRemote')
    return this.result(cwd, [ARGS.push, ARGS.setUpstream, remote, branch], NETWORK)
  }

  /** Pull then push; a branch without upstream is published. */
  private async sync(cwd: string): Promise<ScmResult> {
    const { upstream } = await this.#git.status(cwd)
    if (!upstream) return this.push(cwd)
    const pulled = await this.pull(cwd, this.#pullRebase())
    return pulled.ok ? this.push(cwd) : pulled
  }

  private async defaultRemote(cwd: string): Promise<string | null> {
    const names = ((await this.stdout(cwd, ARGS.remotes)) ?? '').split(NEWLINE).filter((n) => n !== '')
    return names.includes(ORIGIN) ? ORIGIN : (names[0] ?? null)
  }

  private async diffText(cwd: string, path: string, staged: boolean): Promise<string> {
    const args = [...ARGS.diff, ...(staged ? [ARGS.cached] : []), ARGS.endOfOptions, path]
    return (await this.exec(cwd, args, LITERAL)).stdout
  }

  /** The untracked files among `paths` (all untracked files without paths). */
  private async untracked(cwd: string, paths?: string[]): Promise<string[]> {
    const args = paths ? [...ARGS.untracked, ARGS.endOfOptions, ...paths] : ARGS.untracked
    return splitZ((await this.exec(cwd, args, LITERAL)).stdout)
  }

  private async unstagedTracked(cwd: string): Promise<string[]> {
    return splitZ((await this.exec(cwd, ARGS.unstagedNames, LOCAL)).stdout)
  }

  private async hasHead(cwd: string): Promise<boolean> {
    return (await this.stdout(cwd, ARGS.verifyHead)) !== null
  }

  private snapshot(
    t: ScmTarget,
    reason: DestructiveReason,
    rest: Partial<Pick<DestructiveSnapshot, 'paths' | 'stashes' | 'headSha'>>,
  ): Promise<void> {
    return this.#hooks.run({
      worktreeId: t.worktreeId,
      cwd: t.cwd,
      reason,
      paths: [],
      stashes: [],
      headSha: null,
      ...rest,
    })
  }

  /** Runs `op` after every earlier operation on the same repository, then reports the worktree as changed. */
  private mutate(t: ScmTarget, op: () => Promise<ScmResult>): Promise<ScmResult> {
    const run = async () => {
      try {
        return await op()
      } catch (e) {
        return classifyFailure(errorText(e))
      } finally {
        this.#onChanged(t.worktreeId)
      }
    }
    const next = (this.#tails.get(t.cwd) ?? Promise.resolve()).then(run)
    this.#tails.set(t.cwd, next)
    void next.then(() => {
      if (this.#tails.get(t.cwd) === next) this.#tails.delete(t.cwd)
    })
    return next
  }

  /** Never throws: a thrown error (git missing, timeout) reads as a failed run. */
  private async exec(cwd: string, args: readonly string[], opts: GitRunOptions): Promise<GitRunResult> {
    try {
      return await this.#git.run(cwd, [...GIT_FLAGS, ...args], opts)
    } catch (e) {
      return { stdout: '', stderr: errorText(e), exitCode: -1 }
    }
  }

  private async result(cwd: string, args: readonly string[], opts: GitRunOptions = LOCAL): Promise<ScmResult> {
    return toResult(await this.exec(cwd, args, opts))
  }

  /** Trimmed stdout, or null when the command failed. */
  private async stdout(cwd: string, args: readonly string[]): Promise<string | null> {
    const r = await this.exec(cwd, args, LOCAL)
    return r.exitCode === 0 ? r.stdout.trim() : null
  }
}

const toResult = (r: GitRunResult): ScmResult => (r.exitCode === 0 ? OK : classifyFailure(r.stderr.trim() || r.stdout))

function discardReason(paths: string[] | undefined, tracked: string[]): DestructiveReason {
  if (!paths) return DISCARD_ALL
  return tracked.length === 0 ? CLEAN_UNTRACKED : DISCARD
}
