/** The only file that knows upstream DTO and error shapes (projects, agents, board, comments). */
import type { AgentProfile, AgentSession } from '@pragma/module-agents/contract'
import { BoardError, type BoardErrorCode, type BoardSection, type TaskDto } from '@pragma/module-board/contract'
import type { Comment } from '@pragma/module-comments/contract'
import { ProjectsError, type ProjectsErrorCode, type Worktree } from '@pragma/module-projects/contract'
import { z } from '@pragma/sdk'
import {
  CLI_ERROR,
  type CliComment,
  type CliErrorCode,
  type CliProfile,
  type CliSession,
  type CliTask,
  type CliWorktree,
} from '../contract'
import { CliError } from './cli-error'

export const toCliWorktree = (w: Worktree): CliWorktree => ({
  id: w.id,
  projectId: w.projectId,
  branch: w.branch,
  path: w.path,
  isMain: w.isMain,
})

export const toCliProfile = (p: AgentProfile, name: string): CliProfile => ({
  id: p.id,
  name,
  providerId: p.providerId,
  enabled: p.enabled,
  isDefault: p.isDefault,
})

export const toCliSession = (s: AgentSession, profileName: string | null): CliSession => ({
  id: s.id,
  worktreeId: s.worktreeId,
  profileId: s.profileId,
  profileName,
  status: s.status,
  title: s.title || null,
  providerSessionId: s.externalSessionId,
  createdAt: s.createdAt,
})

/** Column and label names come from the task's board section. */
export function toCliTask(t: TaskDto, section: BoardSection): CliTask {
  const column = section.columns.find((c) => c.id === t.columnId)?.name ?? String(t.columnId)
  const labels = t.labelIds.map((id) => section.labels.find((l) => l.id === id)?.name ?? String(id))
  return {
    id: t.id,
    key: t.key,
    projectId: t.projectId,
    title: t.title,
    column,
    priority: t.priority,
    labels,
    worktreeId: t.worktreeId,
    sessionIds: t.sessionIds,
  }
}

export const toCliComment = (c: Comment): CliComment => ({
  id: c.id,
  worktreeId: c.worktreeId,
  source: c.source,
  filePath: c.filePath ?? null,
  lineStart: c.lineStart ?? null,
  lineEnd: c.lineEnd ?? null,
  body: c.body,
  createdAt: c.createdAt,
})

const { invalid_argument: INVALID, not_found: NOT_FOUND, conflict: CONFLICT, internal: INTERNAL } = CLI_ERROR

const PROJECTS_ERRORS: Record<ProjectsErrorCode, CliErrorCode> = {
  notAGitRepo: INVALID,
  bareRepo: INVALID,
  pathNotFound: INVALID,
  alreadyAdded: CONFLICT,
  projectNotFound: NOT_FOUND,
  worktreeNotFound: NOT_FOUND,
  invalidBranchName: INVALID,
  branchNotFound: NOT_FOUND,
  branchCheckedOut: CONFLICT,
  pathExists: CONFLICT,
  cannotRemoveMain: CONFLICT,
  gitNotFound: INTERNAL,
  gitFailed: INTERNAL,
  invalidSettings: INVALID,
  folderNotFound: NOT_FOUND,
  invalidFolderName: INVALID,
}

const BOARD_ERRORS: Record<BoardErrorCode, CliErrorCode> = {
  not_found: NOT_FOUND,
  column_not_found: NOT_FOUND,
  last_column: CONFLICT,
  duplicate_column_name: CONFLICT,
  invalid_target_column: INVALID,
  invalid_branch: INVALID,
  branch_exists: CONFLICT,
  worktree_failed: INTERNAL,
  session_failed: INTERNAL,
  validation: INVALID,
}

/** Any thrown value → a `CliError` with the closest code. */
export function toCliError(e: unknown): CliError {
  if (e instanceof CliError) return e
  if (e instanceof ProjectsError) return new CliError(PROJECTS_ERRORS[e.code], e.message)
  if (e instanceof BoardError) return new CliError(BOARD_ERRORS[e.code], e.message)
  if (e instanceof z.ZodError) return new CliError(INVALID, e.message)
  return new CliError(INTERNAL, e instanceof Error ? e.message : String(e))
}
