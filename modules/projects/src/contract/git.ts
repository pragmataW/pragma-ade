import { createServiceToken, z } from '@pragma/sdk'
import { PROJECTS_SERVICE_IDS } from './ids'
import type { BranchInfo } from './types'

export const GitRunOptionsSchema = z.object({
  input: z.string().optional(),
  /** A non-zero exit resolves instead of throwing `gitFailed`. */
  allowFailure: z.boolean().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
})
export type GitRunOptions = z.infer<typeof GitRunOptionsSchema>

export const GitRunResultSchema = z.object({ stdout: z.string(), stderr: z.string(), exitCode: z.number().int() })
export type GitRunResult = z.infer<typeof GitRunResultSchema>

export const GIT_STATUS_KINDS = ['ordinary', 'renamed', 'unmerged', 'untracked'] as const
export type GitStatusKind = (typeof GIT_STATUS_KINDS)[number]

export const GitStatusEntrySchema = z.object({
  kind: z.enum(GIT_STATUS_KINDS),
  path: z.string(),
  origPath: z.string().optional(),
  index: z.string(),
  worktree: z.string(),
})
export type GitStatusEntry = z.infer<typeof GitStatusEntrySchema>

const nullableCount = z.number().int().nonnegative().nullable()
export const GitStatusSchema = z.object({
  branch: z.string().nullable(),
  oid: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: nullableCount,
  behind: nullableCount,
  entries: z.array(GitStatusEntrySchema),
})
export type GitStatus = z.infer<typeof GitStatusSchema>

export const GitWorktreeEntrySchema = z.object({
  path: z.string(),
  head: z.string().nullable(),
  branch: z.string().nullable(),
  bare: z.boolean(),
  detached: z.boolean(),
  locked: z.boolean(),
  prunable: z.boolean(),
})
export type GitWorktreeEntry = z.infer<typeof GitWorktreeEntrySchema>

/** Absolute realpaths of a worktree's own git dir and the repository's common dir. */
export const GitDirsSchema = z.object({ gitDir: z.string(), commonDir: z.string() })
export type GitDirs = z.infer<typeof GitDirsSchema>

export const ResolvedRepoSchema = z.object({ repoPath: z.string(), isBare: z.boolean() })
export type ResolvedRepo = z.infer<typeof ResolvedRepoSchema>

export const WorktreeAddOptionsSchema = z.object({
  path: z.string(),
  branch: z.string(),
  newBranch: z.boolean(),
  startPoint: z.string().optional(),
})
export type WorktreeAddOptions = z.infer<typeof WorktreeAddOptionsSchema>

/** Thin layer over the `git` CLI (§7). Failing commands reject with `ProjectsError('gitFailed', stderr)`. */
export interface GitService {
  run(cwd: string, args: string[], opts?: GitRunOptions): Promise<GitRunResult>
  /** Runs with `GIT_OPTIONAL_LOCKS=0`: never writes `index`/`index.lock`. */
  status(cwd: string): Promise<GitStatus>
  mergeBase(cwd: string, a: string, b: string): Promise<string | null>
  show(cwd: string, rev: string, path: string): Promise<string | null>
  /** `origin/HEAD` target → `main` → `master` → current branch. */
  defaultBaseBranch(repoPath: string): Promise<string>
  /** The main repository of any path inside it (subfolder or linked worktree); null when not a repo. */
  resolveRepo(path: string): Promise<ResolvedRepo | null>
  gitDirs(worktreePath: string): Promise<GitDirs>
  worktreeList(repoPath: string): Promise<GitWorktreeEntry[]>
  worktreeAdd(repoPath: string, o: WorktreeAddOptions): Promise<void>
  worktreeRemove(repoPath: string, path: string, o: { force: boolean }): Promise<void>
  worktreePrune(repoPath: string): Promise<void>
  branchList(repoPath: string): Promise<BranchInfo[]>
  branchDelete(repoPath: string, branch: string, o: { force: boolean }): Promise<void>
  isValidBranchName(repoPath: string, name: string): Promise<boolean>
  refExists(cwd: string, ref: string): Promise<boolean>
  countCommits(cwd: string, from: string, to: string): Promise<number>
}

export const GitServiceToken = createServiceToken<GitService>(PROJECTS_SERVICE_IDS.git)
