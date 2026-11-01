import { homedir } from 'node:os'
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

function subscribeEvents(ctx: MainContext<ProjectsSettings>, service: Service, watching: Watching): void {
  const { events, log } = ctx
  const warn = (what: string) => (error: unknown) => log.warn(what, error)
  const unwatchFailed = warn(UNWATCH_FAILED)
  events.on(worktreeCreated, ({ worktree }) => {
    void watching.watchWorktree(worktree).catch(warn('watch worktree failed'))
    void watching.refresh(worktree)
    void service.getProject(worktree.projectId).then((p) => p && watching.watchRepoGitDir(p))
  })
  events.on(worktreeRemoved, ({ worktreeId }) => void watching.unwatchWorktree(worktreeId).catch(unwatchFailed))
  events.on(projectRemoved, ({ projectId }) => void watching.unwatchRepo(projectId).catch(unwatchFailed))
  events.on(worktreeSelected, ({ worktreeId }) => {
    ctx.ipc.publish(projectsIpcEvents.selected, { worktreeId })
    if (!worktreeId) return
    void service.getWorktree(worktreeId).then((w) => w && watching.refresh(w))
  })
}

/** Watches everything already known, refreshes counts, then imports changes made while the app was closed. */
async function startBackground(
  ctx: MainContext<ProjectsSettings>,
  service: Service,
  watching: Watching,
): Promise<void> {
  for (const project of await service.listProjects()) {
    for (const w of await service.listWorktrees(project.id)) {
      await watching.watchWorktree(w)
      void watching.refresh(w)
    }
    await watching.watchRepoGitDir(project)
  }
  await service.syncAll()
  ctx.log.debug('projects: background start done')
}

function activate(ctx: MainContext<ProjectsSettings>, opts: ProjectsMainOptions): FsWatcher {
  const repo = new ProjectsRepo(ctx.db)
  const git = opts.git ?? createGitService()
  const watcher = new FsWatcher({ debounceMs: WATCH_DEBOUNCE_MS, maxPaths: CHANGED_PATHS_CAP, log: ctx.log })
  let service: Service | undefined
  const pushState = (): void => {
    void service?.getSnapshot().then((s) => ctx.ipc.publish(projectsIpcEvents.stateChanged, s))
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
  subscribeEvents(ctx, service, watching)
  ctx.services.provide(GitServiceToken, git)
  ctx.services.provide(ProjectsServiceToken, service)
  registerProjectsIpc(ctx, service)
  const active = service
  ctx.commands.register(projectsCommands.selectWorktree, ({ worktreeId }) => active.setActiveWorktree(worktreeId))
  startBackground(ctx, service, watching).catch((error: unknown) => ctx.log.error('projects background start', error))
  return watcher
}

/** The projects main module; options exist for tests (spied git, temp home). */
export function createProjectsMain(opts: ProjectsMainOptions = {}): MainModule<ProjectsSettings> {
  let watcher: FsWatcher | undefined
  return defineMainModule<ProjectsSettings>({
    settings: { schema: ProjectsSettingsSchema, defaults: DEFAULT_PROJECTS_SETTINGS },
    migrations: true,
    activate(ctx) {
      watcher = activate(ctx, opts)
    },
    async deactivate() {
      await watcher?.closeAll()
    },
  })
}
