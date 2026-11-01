import { basename } from 'node:path'
import type { EventDef, Logger } from '@pragma/sdk'
import { GIT_DIR_IGNORE, WATCH_KEY_PREFIX, WORKTREE_IGNORE } from '../constants'
import { type GitService, type Project, type Worktree, type WorktreeChangedPayload, worktreeChanged } from '../contract'
import type { FsWatcher } from './fs-watcher'
import { type GitDirWorktreeRef, mapGitDirPaths } from './git-dir-map'
import type { ProjectsRepo } from './repo'
import type { StatusTracker } from './status-tracker'

export const worktreeKey = (id: string): string => `${WATCH_KEY_PREFIX.worktree}${id}`
export const repoKey = (projectId: string): string => `${WATCH_KEY_PREFIX.repo}${projectId}`

export interface WatchingDeps {
  repo: ProjectsRepo
  git: GitService
  watcher: FsWatcher
  tracker: StatusTracker
  emit: (event: EventDef<WorktreeChangedPayload>, payload: WorktreeChangedPayload) => void
  log: Logger
}

/** Connects worktree folders and repository git dirs to `worktree.changed` and the status tracker. */
export function createWatching(deps: WatchingDeps) {
  const { repo, git, watcher, tracker, log } = deps
  const gitDirNames = new Map<string, string | null>()
  /** In-flight or finished git-dir subscriptions, so a second caller also waits until the watch is live. */
  const repoWatches = new Map<string, Promise<void>>()

  const refresh = (w: Worktree): Promise<void> => tracker.refresh(w.id, w.path)

  async function gitDirName(w: Worktree): Promise<string | null> {
    if (w.isMain) return null
    if (gitDirNames.has(w.id)) return gitDirNames.get(w.id) ?? null
    try {
      const name = basename((await git.gitDirs(w.path)).gitDir)
      gitDirNames.set(w.id, name)
      return name
    } catch (error) {
      log.warn(`cannot resolve git dir of ${w.path}`, error)
      return null
    }
  }

  async function refsFor(projectId: string): Promise<{ refs: GitDirWorktreeRef[]; byId: Map<string, Worktree> }> {
    const live = repo.listWorktrees(projectId)
    const refs = await Promise.all(
      live.map(async (w) => ({
        worktreeId: w.id,
        isMain: w.isMain,
        branch: w.branch,
        baseBranch: w.baseBranch,
        gitDirName: await gitDirName(w),
      })),
    )
    return { refs, byId: new Map(live.map((w) => [w.id, w])) }
  }

  async function onGitDirBatch(projectId: string, paths: string[]): Promise<void> {
    const { refs, byId } = await refsFor(projectId)
    for (const id of mapGitDirPaths(paths, refs)) {
      const w = byId.get(id)
      if (!w) continue
      deps.emit(worktreeChanged, { worktreeId: id, path: w.path, reason: 'head', changedPaths: [], truncated: false })
      void refresh(w)
    }
  }

  /** True when the watch is live; false (already logged) lets a later call retry. */
  async function subscribeGitDir(project: Project): Promise<boolean> {
    const main = repo.listWorktrees(project.id).find((w) => w.isMain)
    if (!main) return false
    try {
      const { commonDir } = await git.gitDirs(main.path)
      await watcher.watch(repoKey(project.id), commonDir, GIT_DIR_IGNORE, (paths) => {
        onGitDirBatch(project.id, paths).catch((error: unknown) => log.warn('git dir batch failed', error))
      })
    } catch (error) {
      log.warn(`cannot watch git dir of ${project.repoPath}`, error)
    }
    return watcher.has(repoKey(project.id))
  }

  return {
    refresh,
    async watchWorktree(w: Worktree): Promise<void> {
      await watcher.watch(worktreeKey(w.id), w.path, WORKTREE_IGNORE, (changedPaths, truncated) => {
        deps.emit(worktreeChanged, { worktreeId: w.id, path: w.path, reason: 'files', changedPaths, truncated })
        void refresh(w)
      })
      void gitDirName(w)
    },
    async unwatchWorktree(id: string): Promise<void> {
      gitDirNames.delete(id)
      tracker.forget(id)
      await watcher.unwatch(worktreeKey(id))
    },
    /** Resolves once the repository's common git dir is watched (or the attempt was logged as failed). */
    watchRepoGitDir(project: Project): Promise<void> {
      const existing = repoWatches.get(project.id)
      if (existing) return existing
      const started = subscribeGitDir(project).then((live) => {
        if (!live) repoWatches.delete(project.id)
      })
      repoWatches.set(project.id, started)
      return started
    },
    async unwatchRepo(projectId: string): Promise<void> {
      repoWatches.delete(projectId)
      await watcher.unwatch(repoKey(projectId))
    },
  }
}
export type Watching = ReturnType<typeof createWatching>
