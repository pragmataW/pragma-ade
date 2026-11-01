import type { Logger } from '@pragma/sdk'
import type { GitService, GitStatus, WorktreeSyncState } from '../contract'

export type StatusUpdate = { changedFiles: number } & WorktreeSyncState

export interface StatusTrackerOptions {
  git: GitService
  onStatus: (worktreeId: string, s: StatusUpdate) => void
  onBranch: (worktreeId: string, branch: string | null) => void
  log?: Logger
}

interface Known extends StatusUpdate {
  branch: string | null
}

const syncOf = (s: GitStatus): WorktreeSyncState =>
  s.upstream === null
    ? { upstream: null, ahead: null, behind: null }
    : { upstream: s.upstream, ahead: s.ahead, behind: s.behind }

const sameStatus = (a: StatusUpdate, b: StatusUpdate): boolean =>
  a.changedFiles === b.changedFiles && a.upstream === b.upstream && a.ahead === b.ahead && a.behind === b.behind

/** Changed-file counts and upstream state per worktree; one `git status` in flight per worktree (+ one re-run). */
export class StatusTracker {
  readonly #opts: StatusTrackerOptions
  readonly #known = new Map<string, Known>()
  readonly #running = new Map<string, { done: Promise<void>; again: boolean }>()
  readonly #epochs = new Map<string, number>()
  #disposed = false

  constructor(opts: StatusTrackerOptions) {
    this.#opts = opts
  }

  refresh(worktreeId: string, path: string): Promise<void> {
    if (this.#disposed) return Promise.resolve()
    const running = this.#running.get(worktreeId)
    if (running) {
      running.again = true
      return running.done
    }
    const state = { again: false, done: Promise.resolve() }
    state.done = (async () => {
      do {
        state.again = false
        await this.#runOnce(worktreeId, path)
      } while (state.again && !this.#disposed)
      this.#running.delete(worktreeId)
    })()
    this.#running.set(worktreeId, state)
    return state.done
  }

  async #runOnce(worktreeId: string, path: string): Promise<void> {
    const epoch = this.#epochs.get(worktreeId) ?? 0
    let status: GitStatus
    try {
      status = await this.#opts.git.status(path)
    } catch (error) {
      this.#opts.log?.warn(`git status failed in ${path}`, error)
      return
    }
    if (this.#disposed || (this.#epochs.get(worktreeId) ?? 0) !== epoch) return
    const next: Known = { changedFiles: status.entries.length, ...syncOf(status), branch: status.branch }
    const prev = this.#known.get(worktreeId)
    this.#known.set(worktreeId, next)
    const { branch: _branch, ...update } = next
    if (!prev || !sameStatus(prev, next)) this.#notify(() => this.#opts.onStatus(worktreeId, update))
    if (prev && prev.branch !== next.branch) this.#notify(() => this.#opts.onBranch(worktreeId, next.branch))
  }

  /** A failing listener must not reject `refresh` (callers fire-and-forget it). */
  #notify(call: () => void): void {
    try {
      call()
    } catch (error) {
      this.#opts.log?.warn('status listener failed', error)
    }
  }

  /** Stops new runs and waits for the ones in flight; later `refresh` calls are no-ops. */
  async dispose(): Promise<void> {
    this.#disposed = true
    await Promise.all([...this.#running.values()].map((r) => r.done))
  }

  get(worktreeId: string): number | null {
    return this.#known.get(worktreeId)?.changedFiles ?? null
  }

  getSync(worktreeId: string): WorktreeSyncState | null {
    const k = this.#known.get(worktreeId)
    return k ? { upstream: k.upstream, ahead: k.ahead, behind: k.behind } : null
  }

  forget(worktreeId: string): void {
    this.#known.delete(worktreeId)
    this.#epochs.set(worktreeId, (this.#epochs.get(worktreeId) ?? 0) + 1)
  }
}
