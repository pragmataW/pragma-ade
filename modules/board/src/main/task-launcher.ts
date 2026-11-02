import { type AgentSession, type AgentSessionsService, SESSION_STATUS } from '@pragma/module-agents/contract'
import type { GitService } from '@pragma/module-projects/contract'
import { FIRST_DUPLICATE_SUFFIX, MAX_BRANCH_SUFFIX, REMOTE_HEAD_RE, SLUG_SEPARATOR } from '../constants'
import {
  BOARD_ERROR,
  BoardError,
  type BoardService,
  type BoardSettings,
  BRANCH_CHECK_REASON,
  type BranchCheck,
  errorMessage,
  IN_PROGRESS_COLUMN_NAME,
  START_STAGE,
  type StartInNewWorktreeInput,
  type StartInWorktreeInput,
  type StartPrep,
  type StartTaskResult,
  type TaskDto,
  type TaskId,
} from '../contract'
import type { BoardProjects } from './service/core'
import { buildTaskPrompt, deriveBranchName } from './task-text'

export interface TaskLauncherDeps {
  service: Pick<BoardService, 'getTask' | 'linkSession' | 'moveTask' | 'updateTask'>
  projects: BoardProjects
  git: Pick<GitService, 'isValidBranchName' | 'defaultBaseBranch'>
  sessions: Pick<AgentSessionsService, 'listProfiles' | 'startSession'>
  getSettings(): BoardSettings
}

type SessionOptions = Pick<StartInWorktreeInput, 'profileId' | 'sendPrompt' | 'promptOverride'>

/** "Start work": validate the branch, create the worktree, start an agent session, link it and move the card. */
export function createTaskLauncher(deps: TaskLauncherDeps) {
  const { service, projects, git, sessions } = deps

  async function requireTask(taskId: TaskId): Promise<TaskDto> {
    const task = await service.getTask(taskId)
    if (!task) throw new BoardError(BOARD_ERROR.not_found, `task ${taskId} not found`)
    return task
  }

  async function repoPath(projectId: string): Promise<string> {
    const project = await projects.getProject(projectId)
    if (!project) throw new BoardError(BOARD_ERROR.not_found, `project ${projectId} not found`)
    return project.repoPath
  }

  const localBranches = async (projectId: string): Promise<Set<string>> =>
    new Set((await projects.listBranches(projectId)).filter((b) => b.kind === 'local').map((b) => b.name))

  async function checkBranch(projectId: string, branch: string): Promise<BranchCheck> {
    const name = branch.trim()
    if (!name || !(await git.isValidBranchName(await repoPath(projectId), name)))
      return { ok: false, reason: BRANCH_CHECK_REASON.invalid }
    if ((await localBranches(projectId)).has(name)) return { ok: false, reason: BRANCH_CHECK_REASON.exists }
    return { ok: true }
  }

  async function freeBranch(projectId: string, base: string): Promise<string> {
    const taken = await localBranches(projectId)
    if (!taken.has(base)) return base
    for (let n = FIRST_DUPLICATE_SUFFIX; n <= MAX_BRANCH_SUFFIX; n++) {
      const candidate = `${base}${SLUG_SEPARATOR}${n}`
      if (!taken.has(candidate)) return candidate
    }
    return base
  }

  async function startSession(task: TaskDto, worktreeId: string, o: SessionOptions): Promise<StartTaskResult> {
    const settings = deps.getSettings()
    const sendPrompt = o.sendPrompt ?? settings.sendPromptByDefault
    const initialPrompt = o.promptOverride ?? (sendPrompt ? buildTaskPrompt(task) : undefined)
    let session: AgentSession
    try {
      session = await sessions.startSession({ worktreeId, profileId: o.profileId, initialPrompt })
    } catch (e) {
      return sessionFailed(worktreeId, errorMessage(e))
    }
    await service.linkSession(task.id, session.id)
    // 03 answers a launch failure (command not found, spawn error, …) with an `error` session instead of throwing:
    // linked (Go to agent → Restart), but the card stays and the drawer reports it.
    if (session.status === SESSION_STATUS.error) return sessionFailed(worktreeId, session.error?.message ?? '')
    const movedToColumnId = settings.moveToInProgressOnStart ? await moveToInProgress(task.id) : null
    return { ok: true, worktreeId, sessionId: session.id, movedToColumnId }
  }

  const sessionFailed = (worktreeId: string, message: string): StartTaskResult => ({
    ok: false,
    stage: START_STAGE.session,
    code: BOARD_ERROR.session_failed,
    message,
    worktreeId,
  })

  async function moveToInProgress(taskId: TaskId): Promise<number | null> {
    try {
      return (await service.moveTask(taskId, IN_PROGRESS_COLUMN_NAME)).columnId
    } catch (e) {
      if (e instanceof BoardError && e.code === BOARD_ERROR.column_not_found) return null
      throw e
    }
  }

  return {
    checkBranch,
    async prepareStart(taskId: TaskId): Promise<StartPrep> {
      const task = await requireTask(taskId)
      const project = await projects.getProject(task.projectId)
      if (!project) throw new BoardError(BOARD_ERROR.not_found, `project ${task.projectId} not found`)
      const branches = await projects.listBranches(project.id)
      const profiles = (await sessions.listProfiles()).filter((p) => p.enabled && p.available)
      const worktrees = (await projects.listWorktrees(project.id)).filter((w) => w.archivedAt === null)
      return {
        taskId,
        projectId: project.id,
        suggestedBranch: await freeBranch(project.id, deriveBranchName(task.key, task.title)),
        baseBranches: branches.map((b) => b.name).filter((n) => !REMOTE_HEAD_RE.test(n)),
        defaultBaseBranch: project.defaultBaseBranch || (await git.defaultBaseBranch(project.repoPath)),
        profiles: profiles.map((p) => ({
          id: p.id,
          name: p.name,
          displayNameKey: p.displayNameKey,
          providerId: p.providerId,
          isDefault: p.isDefault,
        })),
        defaultProfileId: (profiles.find((p) => p.isDefault) ?? profiles[0])?.id ?? null,
        worktrees: worktrees.map((w) => ({ id: w.id, branch: w.branch, path: w.path, isMain: w.isMain })),
      }
    },
    async startInNewWorktree(input: StartInNewWorktreeInput): Promise<StartTaskResult> {
      const task = await requireTask(input.taskId)
      const branch = input.branch.trim()
      const check = await checkBranch(task.projectId, branch)
      if (!check.ok) {
        const code =
          check.reason === BRANCH_CHECK_REASON.exists ? BOARD_ERROR.branch_exists : BOARD_ERROR.invalid_branch
        return { ok: false, stage: START_STAGE.validate, code, message: branch }
      }
      let worktreeId: string
      try {
        worktreeId = (
          await projects.createWorktree({ projectId: task.projectId, branch, baseBranch: input.baseBranch })
        ).id
      } catch (e) {
        return { ok: false, stage: START_STAGE.worktree, code: BOARD_ERROR.worktree_failed, message: errorMessage(e) }
      }
      // Linked right away: a failing agent start leaves the card on its new worktree.
      await service.updateTask(task.id, { worktreeId })
      return startSession(task, worktreeId, input)
    },
    async startInWorktree(input: StartInWorktreeInput): Promise<StartTaskResult> {
      const task = await requireTask(input.taskId)
      const wt = await projects.getWorktree(input.worktreeId)
      if (!wt || wt.projectId !== task.projectId) {
        const message = `worktree ${input.worktreeId} is not in project ${task.projectId}`
        return { ok: false, stage: START_STAGE.validate, code: BOARD_ERROR.validation, message }
      }
      if (task.worktreeId !== wt.id) await service.updateTask(task.id, { worktreeId: wt.id })
      return startSession(task, wt.id, input)
    },
  }
}

export type TaskLauncher = ReturnType<typeof createTaskLauncher>
