import { createServiceToken } from '@pragma/sdk'
import { PROJECTS_SERVICE_IDS } from './ids'
import type { BranchInfo, CreateWorktreeInput, Project, ProjectsSnapshot, Worktree, WorktreeRemovalInfo } from './types'

/** Main-side projects service (§7, §10.3). Other modules list `projects` in `dependsOn` and use this token. */
export interface ProjectsService {
  listProjects(): Promise<Project[]>
  listWorktrees(projectId: string): Promise<Worktree[]>
  /** Archived worktrees are returned too (`archivedAt` set). */
  getWorktree(id: string): Promise<Worktree | null>
  /** Never selects the new worktree. */
  createWorktree(i: CreateWorktreeInput): Promise<Worktree>
  /** `force` defaults to true (the UI already warned about uncommitted changes). */
  removeWorktree(id: string, o: { deleteBranch: boolean; force?: boolean }): Promise<void>
  getActiveWorktreeId(): string | null
  setBaseBranch(worktreeId: string, branch: string): Promise<Worktree>
  getProject(id: string): Promise<Project | null>
  addProject(path: string): Promise<Project>
  /** Only takes the project off the list; the disk is untouched. */
  removeProject(id: string): Promise<void>
  reorderProjects(ids: string[]): Promise<void>
  syncProject(id: string): Promise<void>
  syncAll(): Promise<void>
  setActiveWorktree(id: string | null): Promise<void>
  getChangedFileCount(worktreeId: string): number | null
  getRemovalInfo(id: string): Promise<WorktreeRemovalInfo>
  listBranches(projectId: string): Promise<BranchInfo[]>
  suggestWorktreePath(projectId: string, branch: string): Promise<string>
  getSnapshot(): Promise<ProjectsSnapshot>
}
export const ProjectsServiceToken = createServiceToken<ProjectsService>(PROJECTS_SERVICE_IDS.service)

/** Renderer-side view of the projects state; `subscribe` is `useSyncExternalStore`-compatible. */
export interface ProjectsRendererService {
  getSnapshot(): ProjectsSnapshot
  getActiveWorktree(): Worktree | null
  subscribe(listener: () => void): () => void
  selectWorktree(id: string | null): Promise<void>
}
export const ProjectsRendererServiceToken = createServiceToken<ProjectsRendererService>(PROJECTS_SERVICE_IDS.renderer)
