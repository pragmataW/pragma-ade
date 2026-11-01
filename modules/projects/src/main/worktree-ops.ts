import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { HEAD, ORIGIN_PREFIX, REF_PREFIXES } from '../constants'
import {
  type CreateWorktreeInput,
  PROJECTS_ERROR,
  type Project,
  ProjectsError,
  type ProjectsService,
  type Worktree,
  worktreeCreated,
  worktreeRemoved,
} from '../contract'
import { canonicalPath } from './lib/fs-paths'
import { defaultWorktreePath, expandHome } from './paths'
import type { ServiceCore } from './projects-service'

type WorktreeOps = Pick<
  ProjectsService,
  'listBranches' | 'suggestWorktreePath' | 'createWorktree' | 'getRemovalInfo' | 'removeWorktree'
>

const isNonEmptyDir = (p: string): boolean => existsSync(p) && readdirSync(p).length > 0

/** Branch listing, path suggestion, create and remove of worktrees (§7). */
export function createWorktreeOps(core: ServiceCore): WorktreeOps {
  const { deps } = core
  const { git, repo } = deps

  const suggest = (project: Project, branch: string): string =>
    defaultWorktreePath({
      root: deps.getSettings().worktreesRoot,
      projectName: project.name,
      branch,
      home: deps.home,
      exists: existsSync,
    })

  /** Checks out an existing local branch, tracks `origin/<branch>`, or branches off `base`. */
  async function addWorktree(project: Project, branch: string, path: string, base: string): Promise<void> {
    const repoPath = project.repoPath
    if (await git.refExists(repoPath, `${REF_PREFIXES.heads}${branch}`))
      return git.worktreeAdd(repoPath, { path, branch, newBranch: false })
    const remote = `${ORIGIN_PREFIX}${branch}`
    const startPoint = (await git.refExists(repoPath, `${REF_PREFIXES.remotes}${remote}`)) ? remote : base
    return git.worktreeAdd(repoPath, { path, branch, newBranch: true, startPoint })
  }

  async function createWorktree(input: CreateWorktreeInput): Promise<Worktree> {
    const project = core.requireProject(input.projectId)
    if (!(await git.isValidBranchName(project.repoPath, input.branch)))
      throw new ProjectsError(PROJECTS_ERROR.invalidBranchName, input.branch)
    const path = input.path ? resolve(expandHome(input.path, deps.home)) : suggest(project, input.branch)
    if (isNonEmptyDir(path)) throw new ProjectsError(PROJECTS_ERROR.pathExists, path)
    const baseBranch = input.baseBranch ?? project.defaultBaseBranch
    const worktree = await core.mutex.run(project.repoPath, async () => {
      await addWorktree(project, input.branch, path, baseBranch)
      const row: Worktree = {
        id: core.newId(),
        projectId: project.id,
        path: canonicalPath(path),
        branch: input.branch,
        baseBranch,
        isMain: false,
        createdAt: core.now(),
        archivedAt: null,
      }
      repo.insertWorktree(row)
      return row
    })
    deps.emit(worktreeCreated, { worktree })
    deps.onStateChanged()
    return worktree
  }

  async function unmergedCommits(w: Worktree): Promise<number | null> {
    if (w.branch === null) return null
    try {
      return await git.countCommits(w.path, w.baseBranch, HEAD)
    } catch {
      return null
    }
  }

  return {
    listBranches: async (projectId) => git.branchList(core.requireProject(projectId).repoPath),
    suggestWorktreePath: async (projectId, branch) => suggest(core.requireProject(projectId), branch),
    createWorktree,

    async getRemovalInfo(id) {
      const w = core.requireWorktree(id)
      const status = await git.status(w.path)
      return {
        worktreeId: id,
        isMain: w.isMain,
        branch: w.branch,
        changedFiles: status.entries.length,
        unmergedCommits: await unmergedCommits(w),
      }
    },

    async removeWorktree(id, o) {
      const w = core.requireWorktree(id)
      if (w.isMain) throw new ProjectsError(PROJECTS_ERROR.cannotRemoveMain, w.path)
      const { repoPath } = core.requireProject(w.projectId)
      await core.mutex.run(repoPath, async () => {
        await deps.beforeRemove?.(id)
        if (existsSync(w.path)) await git.worktreeRemove(repoPath, w.path, { force: o.force ?? true })
        else await git.worktreePrune(repoPath)
        if (o.deleteBranch && w.branch) await git.branchDelete(repoPath, w.branch, { force: true })
        repo.archiveWorktree(id, core.now())
      })
      deps.emit(worktreeRemoved, { worktreeId: id, projectId: w.projectId, path: w.path, reason: 'user' })
      core.reselectMainIfActive(w)
      deps.onStateChanged()
    },
  }
}
