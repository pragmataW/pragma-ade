import { homedir } from 'node:os'
import type { Logger } from '@pragma/sdk'
import { defineMainModule, type MainContext, type MainModule } from '@pragma/sdk/main'
import { CHANGED_PATHS_CAP, WATCH_DEBOUNCE_MS } from '../constants'
import {
  DEFAULT_PROJECTS_SETTINGS,
  type GitService,
  GitServiceToken,
  ProjectsServiceToken,
  type ProjectsSettings,
  ProjectsSettingsSchema,
  projectRemoved,
  projectsCommands,
  projectsIpcEvents,
  type Worktree,
  worktreeCreated,
  worktreeRemoved,
  worktreeSelected,
} from '../contract'
import { FsWatcher } from './fs-watcher'
import { createGitService } from './git/git-service'
import { registerProjectsIpc } from './ipc'
import { createProjectsService } from './projects-service'
import { ProjectsRepo } from './repo'
import { StatusTracker } from './status-tracker'
import { createWatching, type Watching } from './watching'

export interface ProjectsMainOptions {
  git?: GitService
  home?: string
}

type Service = ReturnType<typeof createProjectsService>
const UNWATCH_FAILED = 'projects: unwatch failed'

/** Fire-and-forget work that deactivate must wait for before the host closes the database. */
function createBackgroundTasks(log: Logger) {
  const pending = new Set<Promise<void>>()
  return {
    run(what: string, work: Promise<unknown>): void {
      const task = work.then(
        () => undefined,
        (error: unknown) => log.warn(what, error),
      )
      pending.add(task)
      void task.finally(() => pending.delete(task))
    },
    async drain(): Promise<void> {
      while (pending.size > 0) await Promise.all([...pending])
    },
  }
}
type BackgroundTasks = ReturnType<typeof createBackgroundTasks>

/**
 * Watches a worktree and its repository git dir, then refreshes its status. The refresh runs only after
 * both subscriptions are live, so a change made while subscribing is still picked up.
 */
async function trackWorktree(service: Service, watching: Watching, worktree: Worktree): Promise<void> {
  await watching.watchWorktree(worktree)
  const project = await service.getProject(worktree.projectId)
  if (project) await watching.watchRepoGitDir(project)
  await watching.refresh(worktree)
}

function subscribeEvents(
  ctx: MainContext<ProjectsSettings>,
  service: Service,
  watching: Watching,
  tasks: BackgroundTasks,
): void {
  const { events } = ctx
  events.on(worktreeCreated, ({ worktree }) =>
    tasks.run('projects: watch worktree failed', trackWorktree(service, watching, worktree)),
  )
  events.on(worktreeRemoved, ({ worktreeId }) => tasks.run(UNWATCH_FAILED, watching.unwatchWorktree(worktreeId)))
  events.on(projectRemoved, ({ projectId }) => tasks.run(UNWATCH_FAILED, watching.unwatchRepo(projectId)))
  events.on(worktreeSelected, ({ worktreeId }) => {
    ctx.ipc.publish(projectsIpcEvents.selected, { worktreeId })
    if (!worktreeId) return
    tasks.run(
      'projects: refresh selected failed',
      service.getWorktree(worktreeId).then((w) => w && watching.refresh(w)),
    )
  })
}

/** Watches everything already known, refreshes counts, then imports changes made while the app was closed. */
async function startBackground(
  ctx: MainContext<ProjectsSettings>,
  service: Service,
  watching: Watching,
): Promise<void> {
  for (const project of await service.listProjects()) {
    const worktrees = await service.listWorktrees(project.id)
    for (const w of worktrees) await watching.watchWorktree(w)
    await watching.watchRepoGitDir(project)
    // Refresh after the watches are live so nothing changed in between is missed.
    for (const w of worktrees) void watching.refresh(w)
  }
  await service.syncAll()
  ctx.log.debug('projects: background start done')
}

interface Active {
  watcher: FsWatcher
  tracker: StatusTracker
  tasks: BackgroundTasks
}

function activate(ctx: MainContext<ProjectsSettings>, opts: ProjectsMainOptions): Active {
  const repo = new ProjectsRepo(ctx.db)
  const git = opts.git ?? createGitService()
  const watcher = new FsWatcher({ debounceMs: WATCH_DEBOUNCE_MS, maxPaths: CHANGED_PATHS_CAP, log: ctx.log })
  const tasks = createBackgroundTasks(ctx.log)
  let service: Service | undefined
  const pushState = (): void => {
    if (!service) return
    tasks.run(
      'projects: publish state failed',
      service.getSnapshot().then((s) => ctx.ipc.publish(projectsIpcEvents.stateChanged, s)),
    )
  }
  const tracker = new StatusTracker({
    git,
    log: ctx.log,
    onStatus: (worktreeId, s) => ctx.ipc.publish(projectsIpcEvents.statusChanged, { worktreeId, ...s }),
    onBranch: (worktreeId, branch) => {
      if (service?.refreshBranch(worktreeId, branch)) pushState()
    },
  })
  const watching = createWatching({ repo, git, watcher, tracker, emit: (e, p) => ctx.events.emit(e, p), log: ctx.log })
  service = createProjectsService({
    repo,
    git,
    emit: (event, payload) => ctx.events.emit(event, payload),
    onStateChanged: pushState,
    getSettings: () => ctx.settings.get(),
    home: opts.home ?? homedir(),
    statusCounts: tracker,
    beforeRemove: (id) => watching.unwatchWorktree(id),
  })
  subscribeEvents(ctx, service, watching, tasks)
  ctx.services.provide(GitServiceToken, git)
  ctx.services.provide(ProjectsServiceToken, service)
  registerProjectsIpc(ctx, service)
  const active = service
  ctx.commands.register(projectsCommands.selectWorktree, ({ worktreeId }) => active.setActiveWorktree(worktreeId))
  const backgroundFailed = 'projects background start'
  tasks.run(
    backgroundFailed,
    startBackground(ctx, service, watching).catch((error: unknown) => ctx.log.error(backgroundFailed, error)),
  )
  return { watcher, tracker, tasks }
}

/** The projects main module; options exist for tests (spied git, temp home). */
export function createProjectsMain(opts: ProjectsMainOptions = {}): MainModule<ProjectsSettings> {
  let active: Active | undefined
  return defineMainModule<ProjectsSettings>({
    settings: { schema: ProjectsSettingsSchema, defaults: DEFAULT_PROJECTS_SETTINGS },
    migrations: true,
    activate(ctx) {
      active = activate(ctx, opts)
    },
    /** The host closes the database right after this; nothing may touch it once this resolves. */
    async deactivate() {
      if (!active) return
      const { watcher, tracker, tasks } = active
      active = undefined
      await watcher.closeAll()
      await tracker.dispose()
      await tasks.drain()
    },
  })
}
