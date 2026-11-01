import { join } from 'node:path'
import type { EventDef } from '@pragma/sdk'
import { createTempUserData } from '@pragma/test-support'
import type { ProjectsSettings, WorktreeSyncState } from '../../src/contract'
import { createGitService } from '../../src/main/git/git-service'
import { createProjectsService, type ProjectsServiceDeps } from '../../src/main/projects-service'
import { makeTestDb } from './builders'
import { createCleanups } from './cleanups'
import { type FixtureRepo, gitTestEnv, makeClone, makePlainDir, makeRepo } from './git-fixture'

export interface RecordedEvent {
  name: string
  payload: unknown
}

/** Real fixture repos + a test DB + an event recorder; both service suites share it. */
export function makeServiceHarness(over: Partial<ProjectsServiceDeps> = {}) {
  const cleanups = createCleanups()
  const { track } = cleanups
  const db = makeTestDb()
  const scratch = track(createTempUserData())
  const settings: ProjectsSettings = { worktreesRoot: join(scratch.path, 'wt') }
  const events: RecordedEvent[] = []
  const stateChanges = { count: 0 }
  const counts = new Map<string, number>()
  const sync = new Map<string, WorktreeSyncState>()
  const git = createGitService({ baseEnv: gitTestEnv() })
  const deps = (): ProjectsServiceDeps => ({
    repo: db.repo,
    git,
    emit: <P>(event: EventDef<P>, payload: P) => void events.push({ name: event.name, payload }),
    onStateChanged: () => void stateChanges.count++,
    getSettings: () => settings,
    home: join(scratch.path, 'home'),
    statusCounts: { get: (id) => counts.get(id) ?? null, getSync: (id) => sync.get(id) ?? null },
    ...over,
  })
  const h = {
    db,
    git,
    events,
    stateChanges,
    counts,
    sync,
    settings,
    service: createProjectsService(deps()),
    /** A second service instance on the same DB (a restart). */
    newService: () => createProjectsService(deps()),
    names: () => events.map((e) => e.name),
    clearEvents: () => void events.splice(0),
    repo: async (opts?: Parameters<typeof makeRepo>[0]): Promise<FixtureRepo> => track(await makeRepo(opts)),
    clone: async (origin: FixtureRepo, opts?: { bare?: boolean }) => track(await makeClone(origin, opts)),
    plainDir: (): string => track(makePlainDir()).dir,
    cleanup() {
      cleanups.run()
      db.cleanup()
    },
  }
  return h
}
export type ServiceHarness = ReturnType<typeof makeServiceHarness>
