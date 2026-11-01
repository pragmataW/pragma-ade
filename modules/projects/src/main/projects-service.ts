import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { EventDef } from '@pragma/sdk'
import { ACTIVE_WORKTREE_STATE_KEY } from '../constants'
import {
  type GitService,
  type GitWorktreeEntry,
  PROJECTS_ERROR,
  type Project,
  ProjectsError,
  type ProjectsErrorCode,
  type ProjectsService,
  type ProjectsSettings,
  type ProjectsSnapshot,
  projectRemoved,
  toErrorDto,
  type Worktree,
  type WorktreeSyncState,
  worktreeChanged,
  worktreeCreated,
  worktreeRemoved,
  worktreeSelected,
} from '../contract'
import { canonicalPath } from './lib/fs-paths'
import { KeyedMutex } from './lib/keyed-mutex'
import type { ProjectsRepo } from './repo'
import { createWorktreeOps } from './worktree-ops'

export interface ProjectsServiceDeps {
  repo: ProjectsRepo
  git: GitService
  emit: <P>(event: EventDef<P>, payload: P) => void
  /** Called once after every change that alters the snapshot (the wiring pushes `stateChanged`). */
  onStateChanged: () => void
  getSettings: () => ProjectsSettings
  home: string
  statusCounts: { get(worktreeId: string): number | null; getSync(worktreeId: string): WorktreeSyncState | null }
  /** Runs before a worktree folder is removed (the wiring stops its watcher). */
  beforeRemove?: (worktreeId: string) => Promise<void>
  now?: () => number
  newId?: () => string
}

export interface ProjectsServiceInternals {
  /** Records (code) or clears (null) a project's sync error; true when it changed. */
  setProjectError(projectId: string, code: ProjectsErrorCode | null): boolean
  /** Stores a branch seen by the status tracker; true when it changed. */
  refreshBranch(worktreeId: string, branch: string | null): boolean
}

/** Shared state and helpers of the service, used by the worktree operations too. */
export interface ServiceCore {
  deps: ProjectsServiceDeps
  mutex: KeyedMutex
  now: () => number
  newId: () => string
  requireProject(id: string): Project
  requireWorktree(id: string): Worktree
  mainOf(projectId: string): Worktree | null
  getActiveId(): string | null
  setActive(id: string | null): void
  /** Reselects the project's main checkout when `w` was active. */
  reselectMainIfActive(w: Worktree): void
}

function createCore(deps: ProjectsServiceDeps): ServiceCore {
  const { repo } = deps
  const liveWorktree = (id: string): Worktree | null => {
    const w = repo.getWorktree(id)
    return w && w.archivedAt === null && repo.getProject(w.projectId) ? w : null
  }
  const stored = repo.getState(ACTIVE_WORKTREE_STATE_KEY)
  let activeId = stored && liveWorktree(stored) ? stored : null
  const core: ServiceCore = {
    deps,
    mutex: new KeyedMutex(),
    now: deps.now ?? Date.now,
    newId: deps.newId ?? randomUUID,
    requireProject(id) {
      const p = repo.getProject(id)
      if (!p) throw new ProjectsError(PROJECTS_ERROR.projectNotFound, id)
      return p
    },
    requireWorktree(id) {
      const w = liveWorktree(id)
      if (!w) throw new ProjectsError(PROJECTS_ERROR.worktreeNotFound, id)
      return w
    },
    mainOf: (projectId) => repo.listWorktrees(projectId).find((w) => w.isMain) ?? null,
    getActiveId: () => activeId,
    setActive(id) {
      if (id === activeId) return
      const previousWorktreeId = activeId
      activeId = id
      repo.setState(ACTIVE_WORKTREE_STATE_KEY, id)
      deps.emit(worktreeSelected, { worktreeId: id, previousWorktreeId })
    },
    reselectMainIfActive(w) {
      if (activeId === w.id) core.setActive(core.mainOf(w.projectId)?.id ?? null)
    },
  }
  return core
}

/** Applies one `git worktree list` result to the DB; true when anything changed. */
function applyWorktreeEntries(core: ServiceCore, project: Project, entries: GitWorktreeEntry[]): boolean {
  const { repo, emit } = core.deps
  const live = new Map(repo.listWorktrees(project.id).map((w) => [w.path, w]))
  const seen = new Set<string>()
  let changed = false
  entries.forEach((entry, index) => {
    if (entry.bare || entry.prunable) return
    const path = canonicalPath(entry.path)
    seen.add(path)
    const row = live.get(path)
    if (row) {
      if (row.branch === entry.branch) return
      repo.updateWorktreeBranch(row.id, entry.branch)
      changed = true
      return
    }
    const worktree: Worktree = {
      id: core.newId(),
      projectId: project.id,
      path,
      branch: entry.branch,
      baseBranch: project.defaultBaseBranch,
      isMain: index === 0,
      createdAt: core.now(),
      archivedAt: null,
    }
    repo.insertWorktree(worktree)
    emit(worktreeCreated, { worktree })
    changed = true
  })
  for (const row of live.values()) {
    if (seen.has(row.path)) continue
    repo.archiveWorktree(row.id, core.now())
    emit(worktreeRemoved, { worktreeId: row.id, projectId: project.id, path: row.path, reason: 'external' })
    core.reselectMainIfActive(row)
    changed = true
  }
  return changed
}

/** `ProjectsServiceToken` implementation (§7, §10.3) over the repo and the git CLI. */
export function createProjectsService(deps: ProjectsServiceDeps): ProjectsService & ProjectsServiceInternals {
  const { repo, git } = deps
  const core = createCore(deps)
  const projectErrors = new Map<string, ProjectsErrorCode>()

  function setProjectError(projectId: string, code: ProjectsErrorCode | null): boolean {
    if ((projectErrors.get(projectId) ?? null) === code) return false
    if (code === null) projectErrors.delete(projectId)
    else projectErrors.set(projectId, code)
    return true
  }

  const syncInner = (project: Project): Promise<boolean> =>
    core.mutex.run(project.repoPath, async () => {
      let entries: GitWorktreeEntry[]
      try {
        entries = await git.worktreeList(project.repoPath)
      } catch (e) {
        return setProjectError(project.id, toErrorDto(e).code)
      }
      const cleared = setProjectError(project.id, null)
      return applyWorktreeEntries(core, project, entries) || cleared
    })

  async function upsertProject(repoPath: string): Promise<Project> {
    const existing = repo.findProjectByPath(repoPath)
    if (existing?.archivedAt === null) throw new ProjectsError(PROJECTS_ERROR.alreadyAdded, repoPath)
    if (existing) {
      repo.unarchiveProject(existing.id)
      return core.requireProject(existing.id)
    }
    const defaultBaseBranch = await git.defaultBaseBranch(repoPath)
    return repo.insertProject({
      id: core.newId(),
      name: basename(repoPath),
      repoPath,
      defaultBaseBranch,
      createdAt: core.now(),
    })
  }

  return {
    listProjects: async () => repo.listProjects(),
    listWorktrees: async (projectId) => repo.listWorktrees(projectId),
    getWorktree: async (id) => repo.getWorktree(id),
    getProject: async (id) => repo.getProject(id),
    getActiveWorktreeId: () => core.getActiveId(),
    getChangedFileCount: (id) => deps.statusCounts.get(id),

    async addProject(path) {
      if (!existsSync(path)) throw new ProjectsError(PROJECTS_ERROR.pathNotFound, path)
      const resolved = await git.resolveRepo(path)
      if (!resolved) throw new ProjectsError(PROJECTS_ERROR.notAGitRepo, path)
      if (resolved.isBare) throw new ProjectsError(PROJECTS_ERROR.bareRepo, path)
      const project = await upsertProject(resolved.repoPath)
      await syncInner(project)
      if (core.getActiveId() === null) core.setActive(core.mainOf(project.id)?.id ?? null)
      deps.onStateChanged()
      return project
    },

    async removeProject(id) {
      const project = core.requireProject(id)
      const worktrees = repo.listWorktrees(id)
      const activeProject = repo.getWorktree(core.getActiveId() ?? '')?.projectId
      repo.archiveProject(id, core.now())
      for (const w of worktrees)
        deps.emit(worktreeRemoved, { worktreeId: w.id, projectId: id, path: w.path, reason: 'projectRemoved' })
      if (activeProject === id) core.setActive(null)
      projectErrors.delete(id)
      deps.emit(projectRemoved, { projectId: id, repoPath: project.repoPath })
      deps.onStateChanged()
    },

    async reorderProjects(ids) {
      repo.setProjectOrder(ids)
      deps.onStateChanged()
    },

    async syncProject(id) {
      if (await syncInner(core.requireProject(id))) deps.onStateChanged()
    },

    async syncAll() {
      let changed = false
      for (const project of repo.listProjects()) changed = (await syncInner(project)) || changed
      if (changed) deps.onStateChanged()
    },

    async setActiveWorktree(id) {
      if (id !== null) core.requireWorktree(id)
      core.setActive(id)
    },

    async setBaseBranch(worktreeId, branch) {
      const w = core.requireWorktree(worktreeId)
      if (!(await git.refExists(w.path, branch))) throw new ProjectsError(PROJECTS_ERROR.branchNotFound, branch)
      repo.updateWorktreeBaseBranch(worktreeId, branch)
      deps.emit(worktreeChanged, { worktreeId, path: w.path, reason: 'baseBranch', changedPaths: [], truncated: false })
      deps.onStateChanged()
      return core.requireWorktree(worktreeId)
    },

    async getSnapshot(): Promise<ProjectsSnapshot> {
      const worktrees = repo.listAllLiveWorktrees()
      const changedFiles: Record<string, number> = {}
      const sync: Record<string, WorktreeSyncState> = {}
      for (const w of worktrees) {
        const count = deps.statusCounts.get(w.id)
        if (count !== null) changedFiles[w.id] = count
        const s = deps.statusCounts.getSync(w.id)
        if (s) sync[w.id] = s
      }
      return {
        projects: repo.listProjects(),
        worktrees,
        changedFiles,
        sync,
        projectErrors: Object.fromEntries(projectErrors),
        activeWorktreeId: core.getActiveId(),
      }
    },

    setProjectError,
    refreshBranch(worktreeId, branch) {
      const w = repo.getWorktree(worktreeId)
      if (!w || w.branch === branch) return false
      repo.updateWorktreeBranch(worktreeId, branch)
      return true
    },

    ...createWorktreeOps(core),
  }
}
