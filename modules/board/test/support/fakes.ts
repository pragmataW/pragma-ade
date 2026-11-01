import type { AgentStatusService, SessionStatusInfo } from '@pragma/module-agent-status/contract'
import type {
  AgentProfile,
  AgentSession,
  AgentSessionsService,
  StartSessionInput,
} from '@pragma/module-agents/contract'
import { aProfile, aSession } from '@pragma/module-agents/testing'
import type {
  BranchInfo,
  CreateWorktreeInput,
  GitService,
  Project,
  ProjectsService,
  Worktree,
} from '@pragma/module-projects/contract'
import { BOARD_SETTINGS_DEFAULTS, type BoardChangedPayload, type BoardSettings } from '../../src/contract'
import { createBoardService } from '../../src/main/board-service'
import { type BoardRepo, createBoardRepo } from '../../src/main/repo'
import { createSessionInfo } from '../../src/main/session-info'
import { NOW } from './builders'
import { openTestDb, type TestDb } from './db'

export const aProject = (id: string, name = id, sortOrder = 0): Project => ({
  id,
  name,
  repoPath: `/repos/${id}`,
  defaultBaseBranch: 'main',
  createdAt: NOW,
  sortOrder,
})

export const aWorktree = (id: string, projectId: string, branch: string | null = id, isMain = false): Worktree => ({
  id,
  projectId,
  path: `/wt/${id}`,
  branch,
  baseBranch: 'main',
  isMain,
  createdAt: NOW,
  archivedAt: null,
})

export type FakeProjects = ReturnType<typeof fakeProjects>

/** In-memory projects service: `branches` is a set of local branch names per project. */
export function fakeProjects(
  o: { projects?: Project[]; worktrees?: Worktree[]; branches?: Record<string, string[]> } = {},
) {
  const state = {
    projects: o.projects ?? [aProject('p1', 'pragma-ade'), aProject('p2', 'other', 1)],
    worktrees: o.worktrees ?? [aWorktree('w1', 'p1', 'main', true), aWorktree('w2', 'p2', 'main', true)],
    branches: new Map(Object.entries(o.branches ?? {}).map(([k, v]) => [k, new Set(v)])),
    activeWorktreeId: null as string | null,
    created: [] as CreateWorktreeInput[],
    failCreate: null as Error | null,
  }
  const branchesOf = (projectId: string): Set<string> => {
    const set = state.branches.get(projectId) ?? new Set(['main'])
    state.branches.set(projectId, set)
    return set
  }
  const service: Pick<
    ProjectsService,
    | 'listProjects'
    | 'getProject'
    | 'listWorktrees'
    | 'getWorktree'
    | 'createWorktree'
    | 'listBranches'
    | 'getActiveWorktreeId'
  > = {
    listProjects: async () => [...state.projects].sort((a, b) => a.sortOrder - b.sortOrder),
    getProject: async (id) => state.projects.find((p) => p.id === id) ?? null,
    listWorktrees: async (projectId) => state.worktrees.filter((w) => w.projectId === projectId),
    getWorktree: async (id) => state.worktrees.find((w) => w.id === id) ?? null,
    async createWorktree(input) {
      state.created.push(input)
      if (state.failCreate) throw state.failCreate
      const wt = aWorktree(`wt-${state.created.length}`, input.projectId, input.branch)
      state.worktrees.push(wt)
      branchesOf(input.projectId).add(input.branch)
      return wt
    },
    listBranches: async (projectId): Promise<BranchInfo[]> => [
      ...[...branchesOf(projectId)].map((name) => ({ name, kind: 'local' as const, checkedOutAt: null })),
      { name: 'origin/HEAD', kind: 'remote', checkedOutAt: null },
      { name: 'origin/main', kind: 'remote', checkedOutAt: null },
    ],
    getActiveWorktreeId: () => state.activeWorktreeId,
  }
  return { state, service }
}

const INVALID_BRANCH = /\.\.|\s|\/$|^-/

/** `isValidBranchName` rejects `..`, whitespace, a trailing slash and a leading dash (like `check-ref-format`). */
export function fakeGit(): Pick<GitService, 'isValidBranchName' | 'defaultBaseBranch'> {
  return {
    isValidBranchName: async (_repo, name) => name.length > 0 && !INVALID_BRANCH.test(name),
    defaultBaseBranch: async () => 'main',
  }
}

export type FakeSessions = ReturnType<typeof fakeAgentSessions>

/** In-memory agent sessions: `startSession` records its input (or throws `failStart`). */
export function fakeAgentSessions(
  profiles: AgentProfile[] = [
    aProfile({ id: 'fake', name: 'Fake', providerId: 'custom', isDefault: true }),
    aProfile({ id: 'other', name: 'Other', providerId: 'custom' }),
    aProfile({ id: 'off', name: 'Off', providerId: 'custom', enabled: false }),
  ],
) {
  const state = {
    profiles,
    sessions: new Map<string, AgentSession>(),
    started: [] as StartSessionInput[],
    failStart: null as Error | null,
  }
  const service: Pick<AgentSessionsService, 'listProfiles' | 'getProfile' | 'getSession' | 'startSession'> = {
    listProfiles: async () => state.profiles,
    getProfile: async (id) => state.profiles.find((p) => p.id === id) ?? null,
    getSession: async (id) => state.sessions.get(id) ?? null,
    async startSession(input) {
      state.started.push(input)
      if (state.failStart) throw state.failStart
      const profile = state.profiles.find((p) => p.id === input.profileId) ?? state.profiles[0]
      const id = `s${state.started.length}`
      const session = aSession(id, state.started.length, {
        worktreeId: input.worktreeId,
        profileId: profile?.id ?? null,
        providerId: profile?.providerId ?? 'custom',
      })
      state.sessions.set(id, session)
      return session
    },
  }
  return { state, service, add: (s: AgentSession) => state.sessions.set(s.id, s) }
}

/** agent-status over a fixed map. */
export function fakeStatus(map: Map<string, Pick<SessionStatusInfo, 'status' | 'turnCompleted'>> = new Map()) {
  const service: Pick<AgentStatusService, 'getStatus'> = {
    getStatus: (id) => {
      const s = map.get(id)
      return s ? ({ ...s, sessionId: id } as SessionStatusInfo) : null
    },
  }
  return { map, service }
}

export interface ServiceHarness {
  db: TestDb
  repo: BoardRepo
  projects: FakeProjects
  sessions: FakeSessions
  status: ReturnType<typeof fakeStatus> | undefined
  settings: BoardSettings
  emitted: BoardChangedPayload[]
  service: ReturnType<typeof createBoardService>
  /** A fresh repo + service over the same DB file (reopened). */
  restart(): Promise<ReturnType<typeof createBoardService>>
}

/** Temp DB + fakes wired into the real service (every service test starts here). */
export async function makeService(
  o: {
    projects?: Parameters<typeof fakeProjects>[0]
    profiles?: AgentProfile[]
    withStatus?: boolean
    settings?: Partial<BoardSettings>
  } = {},
): Promise<ServiceHarness> {
  const db = await openTestDb()
  const projects = fakeProjects(o.projects)
  const sessions = fakeAgentSessions(o.profiles)
  const status = o.withStatus === false ? undefined : fakeStatus()
  const settings = { ...BOARD_SETTINGS_DEFAULTS, ...o.settings }
  const emitted: BoardChangedPayload[] = []
  let clock = NOW
  const build = (repo: BoardRepo) =>
    createBoardService({
      repo,
      projects: projects.service,
      git: fakeGit(),
      agentSessions: sessions.service,
      sessions: createSessionInfo({ sessions: sessions.service, status: status?.service }),
      getSettings: () => settings,
      emit: (p) => emitted.push(p),
      now: () => ++clock,
    })
  const h: ServiceHarness = {
    db,
    repo: createBoardRepo(db.opened.db),
    projects,
    sessions,
    status,
    settings,
    emitted,
    service: undefined as unknown as ReturnType<typeof createBoardService>,
    async restart() {
      const opened = await db.reopen()
      h.repo = createBoardRepo(opened.db)
      h.service = build(h.repo)
      return h.service
    },
  }
  h.service = build(h.repo)
  return h
}
