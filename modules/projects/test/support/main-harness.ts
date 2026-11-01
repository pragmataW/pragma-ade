import { join } from 'node:path'
import type { MainContext } from '@pragma/sdk/main'
import { defineMainModule } from '@pragma/sdk/main'
import type { ModuleRecord } from '@pragma/sdk/runtime/main'
import { createFakePlatform, createTempUserData, createTestModuleHost, loadModuleRecord } from '@pragma/test-support'
import {
  type GitService,
  type ProjectsService,
  ProjectsServiceToken,
  projectsIpcEvents,
  type StatusChangedPayload,
  type WorktreeChangedPayload,
  worktreeChanged,
} from '../../src/contract'
import { createGitService } from '../../src/main/git/git-service'
import { createProjectsMain } from '../../src/main/wiring'
import { MODULE_DIR } from './builders'
import { createCleanups } from './cleanups'
import { gitTestEnv } from './git-fixture'

/** A module that depends on `projects` and hands its context to the test (event bus, services). */
function probeRecord(onActivate: (ctx: MainContext) => void): ModuleRecord {
  return {
    manifest: {
      id: 'projects-probe',
      kind: 'feature',
      displayNameKey: 'projects-probe:module.name',
      dependsOn: ['projects'],
      optionalDependsOn: [],
      core: false,
    },
    packageName: '@pragma/module-projects-probe',
    version: '0.0.0',
    dir: MODULE_DIR,
    extraResources: [],
    main: defineMainModule({ activate: onActivate }),
    migrations: [],
    locales: {},
  }
}

/** The real main host with the projects module (spied git, isolated git env) plus a probe module. */
export async function startProjectsHost() {
  const cleanups = createCleanups()
  const scratch = cleanups.track(createTempUserData())
  const real = createGitService({ baseEnv: gitTestEnv() })
  const statusCalls = { count: 0 }
  const git: GitService = {
    ...real,
    status: (cwd) => {
      statusCalls.count++
      return real.status(cwd)
    },
  }
  const dialogReplies: { openFolder: string | null } = { openFolder: null }
  const platform = createFakePlatform({ dialogReplies })
  const record = await loadModuleRecord(MODULE_DIR)
  record.main = createProjectsMain({ git, home: join(scratch.path, 'home') }) as ModuleRecord['main']
  let probe: MainContext | undefined
  const t = await createTestModuleHost({
    modules: [
      record,
      probeRecord((ctx) => {
        probe = ctx
      }),
    ],
    platform,
    settings: { projects: { worktreesRoot: join(scratch.path, 'wt') } },
  })
  const ctx = probe as MainContext
  const changed: WorktreeChangedPayload[] = []
  ctx.events.on(worktreeChanged, (p) => void changed.push(p))
  const statuses: StatusChangedPayload[] = []
  t.ipc.subscribe(projectsIpcEvents.statusChanged, (p) => void statuses.push(p))
  const stateChanges = { count: 0 }
  t.ipc.subscribe(projectsIpcEvents.stateChanged, () => void stateChanges.count++)
  return {
    t,
    ctx,
    service: ctx.services.get(ProjectsServiceToken) as ProjectsService,
    git: real,
    statusCalls,
    dialogReplies,
    changed,
    statuses,
    stateChanges,
    cleanups,
    async dispose() {
      await t.dispose()
      cleanups.run()
    },
  }
}
export type ProjectsHost = Awaited<ReturnType<typeof startProjectsHost>>
