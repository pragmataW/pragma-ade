import type {
  AgentProfile,
  AgentSession,
  AgentSessionsService,
  LaunchDecorator,
  StartSessionInput,
} from '@pragma/module-agents/contract'
import { aProfile, aSession } from '@pragma/module-agents/testing'
import type {
  BoardSection,
  BoardService,
  ColumnRef,
  CreateTaskInput,
  LabelDto,
  TaskDto,
  TaskFilter,
  UpdateTaskPatch,
} from '@pragma/module-board/contract'
import { BoardError } from '@pragma/module-board/contract'
import type { Comment, CommentsService } from '@pragma/module-comments/contract'
import type { CreateWorktreeInput, Project, ProjectsService, Worktree } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import type { SessionTranscriptLocation, SessionTranscriptQuery } from '../../src/contract'
import type { CliHandlerDeps } from '../../src/main/handlers'
import type { TranscriptLocator } from '../../src/main/session-transcripts'

const NOW = 1_700_000_000_000

/** Only the methods a fake implements; the rest are never called by this module. */
const asService = <T>(partial: Partial<T>): T => partial as T

export const aProject = (id: string, repoPath = `/repos/${id}`): Project => ({
  id,
  name: id,
  repoPath,
  defaultBaseBranch: 'main',
  createdAt: NOW,
  sortOrder: 0,
})

export const aWorktree = (id: string, over: Partial<Worktree> = {}): Worktree => ({
  id,
  projectId: 'p1',
  path: `/wt/${id}`,
  branch: id,
  baseBranch: 'main',
  isMain: false,
  createdAt: NOW,
  archivedAt: null,
  ...over,
})

export function fakeProjects(
  o: { projects?: Project[]; worktrees?: Worktree[]; activeId?: string | null; failCreate?: Error } = {},
) {
  const state = {
    projects: o.projects ?? [aProject('p1')],
    worktrees: o.worktrees ?? [aWorktree('w1', { branch: 'main', isMain: true })],
    created: [] as CreateWorktreeInput[],
    removed: [] as string[],
  }
  const service = asService<ProjectsService>({
    listProjects: async () => state.projects,
    getProject: async (id) => state.projects.find((p) => p.id === id) ?? null,
    listWorktrees: async (projectId) => state.worktrees.filter((w) => w.projectId === projectId),
    getWorktree: async (id) => state.worktrees.find((w) => w.id === id) ?? null,
    getActiveWorktreeId: () => o.activeId ?? null,
    async createWorktree(input) {
      if (o.failCreate) throw o.failCreate
      state.created.push(input)
      const w = aWorktree(`w${state.worktrees.length + 1}`, { projectId: input.projectId, branch: input.branch })
      state.worktrees.push(w)
      return w
    },
    async removeWorktree(id) {
      state.removed.push(id)
    },
  })
  return Object.assign(service, { state })
}

export function fakeAgents(o: { profiles?: AgentProfile[]; sessions?: AgentSession[]; failStart?: Error } = {}) {
  const state = {
    profiles: o.profiles ?? [aProfile({ id: 'claude', name: 'Claude' }), aProfile({ id: 'oc', name: 'OpenCode' })],
    sessions: o.sessions ?? [],
    started: [] as StartSessionInput[],
    decorators: [] as LaunchDecorator[],
  }
  const service = asService<AgentSessionsService>({
    registerLaunchDecorator(d) {
      state.decorators.push(d)
      return () => state.decorators.splice(state.decorators.indexOf(d), 1)
    },
    listProfiles: async () => state.profiles,
    getProfile: async (id) => state.profiles.find((p) => p.id === id) ?? null,
    listSessions: async (worktreeId) => state.sessions.filter((s) => s.worktreeId === worktreeId),
    getSession: async (id) => state.sessions.find((s) => s.id === id) ?? null,
    async startSession(input) {
      if (o.failStart) throw o.failStart
      state.started.push(input)
      const s = aSession(`s${state.started.length}`, state.sessions.length + 1, {
        worktreeId: input.worktreeId,
        profileId: input.profileId ?? null,
      })
      state.sessions.push(s)
      return s
    },
  })
  return Object.assign(service, { state })
}

export const aComment = (id: string, over: Partial<Comment> = {}): Comment =>
  ({
    id,
    worktreeId: 'w1',
    source: 'editor',
    filePath: 'a.ts',
    body: id,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }) as Comment

export function fakeComments(comments: Comment[] = []) {
  return asService<CommentsService>({
    listThreads: async (worktreeId) => comments.filter((c) => c.worktreeId === worktreeId),
  })
}

const COLUMNS = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done']

export const aTask = (id: number, over: Partial<TaskDto> = {}): TaskDto => ({
  id,
  key: `P1-${id}`,
  number: id,
  boardId: 1,
  projectId: 'p1',
  columnId: 1,
  title: `Task ${id}`,
  descriptionMd: '',
  priority: 'none',
  labelIds: [],
  worktreeId: null,
  sortKey: 'a',
  sessions: [],
  sessionIds: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
})

/** In-memory board for one project: columns 1..5 (Backlog … Done), label 1 = `ui`. */
export function fakeBoard(tasks: TaskDto[] = []) {
  const state = {
    tasks,
    calls: [] as [string, ...unknown[]][],
    failUpdate: false,
  }
  let section: BoardSection = {
    board: { id: 1, projectId: 'p1', name: 'p1', keyPrefix: 'P1' },
    projectName: 'p1',
    columns: COLUMNS.map((name, i) => ({ id: i + 1, boardId: 1, name, sortKey: String(i) })),
    labels: [{ id: 1, boardId: 1, name: 'ui', color: 'blue' }],
  }
  const columnId = (ref: ColumnRef): number => {
    const c = section.columns.find((col) => col.id === ref || col.name.toLowerCase() === String(ref).toLowerCase())
    if (!c) throw new BoardError('column_not_found', `column ${String(ref)} not found`)
    return c.id
  }
  const task = (id: number): TaskDto => {
    const t = state.tasks.find((x) => x.id === id)
    if (!t) throw new BoardError('not_found', `task ${id} not found`)
    return t
  }
  /** Like the real board: unknown label names are created, and getBoard returns a new section afterwards. */
  const labelId = (ref: string | number): number => {
    const found = section.labels.find((l) => l.id === ref || l.name === ref)
    if (found) return found.id
    const created: LabelDto = { id: section.labels.length + 1, boardId: 1, name: String(ref), color: 'gray' }
    section = { ...section, labels: [...section.labels, created] }
    return created.id
  }
  const service = asService<BoardService>({
    getBoard: async () => section,
    async listTasks(filter: TaskFilter = {}) {
      state.calls.push(['listTasks', filter])
      return state.tasks.filter(
        (t) =>
          (!filter.projectId || t.projectId === filter.projectId) &&
          (filter.column === undefined || t.columnId === columnId(filter.column)) &&
          (!filter.sessionId || t.sessionIds.includes(filter.sessionId)),
      )
    },
    getTask: async (ref) => state.tasks.find((t) => String(t.id) === String(ref) || t.key === ref) ?? null,
    async createTask(input: CreateTaskInput) {
      state.calls.push(['createTask', input])
      const t = aTask(state.tasks.length + 100, {
        title: input.title,
        descriptionMd: input.descriptionMd ?? '',
        priority: input.priority ?? 'none',
        columnId: input.column === undefined ? 1 : columnId(input.column),
        labelIds: (input.labels ?? []).map(labelId),
      })
      state.tasks.push(t)
      return t
    },
    async updateTask(id, patch: UpdateTaskPatch) {
      state.calls.push(['updateTask', id, patch])
      if (state.failUpdate) throw new Error('update failed')
      const t = task(id)
      if (patch.descriptionMd !== undefined) t.descriptionMd = patch.descriptionMd
      if (patch.title !== undefined) t.title = patch.title
      return t
    },
    async moveTask(id, column) {
      state.calls.push(['moveTask', id, column])
      const t = task(id)
      t.columnId = columnId(column)
      return t
    },
    async linkSession(taskId, sessionId) {
      state.calls.push(['linkSession', taskId, sessionId])
      task(taskId).sessionIds.push(sessionId)
    },
  })
  return Object.assign(service, { state })
}

const noop = (): void => undefined
export const silentLog = (): Logger => ({ debug: noop, info: noop, warn: noop, error: noop, child: () => silentLog() })

export const aTranscript = (over: Partial<SessionTranscriptLocation> = {}): SessionTranscriptLocation => ({
  path: '/home/.claude/projects/-repo/ext-1.jsonl',
  format: 'Claude Code JSONL',
  cwd: '/repo',
  readCommand: null,
  extraPaths: [],
  ...over,
})

/** `{ providerId: { providerSessionId: location } }`; every query is recorded. */
export function fakeTranscripts(
  byProvider: Record<string, Record<string, SessionTranscriptLocation>> = {},
): TranscriptLocator & { queries: [string, SessionTranscriptQuery][] } {
  const queries: [string, SessionTranscriptQuery][] = []
  return {
    queries,
    home: '/home',
    env: {},
    log: silentLog(),
    providers: () =>
      Object.entries(byProvider).map(([id, sessions]) => ({
        id,
        transcript: {
          async locateTranscript(q) {
            queries.push([id, q])
            return sessions[q.sessionId] ?? null
          },
        },
      })),
  }
}

/** Handler deps over fakes; `over` replaces any of them. */
export function makeDeps(over: Partial<CliHandlerDeps> = {}): CliHandlerDeps {
  return {
    projects: fakeProjects(),
    agents: fakeAgents(),
    board: fakeBoard(),
    comments: fakeComments(),
    nameOf: (p) => p.name ?? p.id,
    handoff: async () => {
      throw new Error('handoff not wired in this test')
    },
    log: silentLog(),
    transcripts: fakeTranscripts(),
    ...over,
  }
}

export const context = (over: Record<string, string> = {}) => ({ cwd: '/elsewhere', ...over })
