import { join } from 'node:path'
import { TERMINAL_MODE } from '../../src/contract'
import { createLaunchContextFactory } from '../../src/main/launch/context'
import { LaunchDecoratorRegistry } from '../../src/main/launch/decorators'
import { createResolve } from '../../src/main/launch/resolve'
import { SessionTempDirs } from '../../src/main/launch/session-temp'
import { ProfilesStore } from '../../src/main/profiles/profiles-store'
import { AgentSessionsServiceImpl } from '../../src/main/service/agent-sessions-service'
import { createTerminalModeHandler } from '../../src/main/service/terminal-mode-handler'
import { SessionsStore } from '../../src/main/sessions/sessions-store'
import { type FakeProviderDef, makeProviders, storeDeps } from './builders'
import type { TestDb } from './db'
import { fakeEvents, fakeProjects, fakePty, recordingLog } from './fakes'

export const tUntitled = (key: string, o?: { n?: unknown }) => `${key}#${String(o?.n)}`

/** The real service over a test DB with fake pty/projects/events; commands resolve to `/bin/<cmd>` unless `missing`. */
export function makeService(db: TestDb, opts: { providers?: FakeProviderDef[]; worktrees?: [string, string][] } = {}) {
  const providers = makeProviders(opts.providers)
  const profiles = new ProfilesStore(db.db, providers, storeDeps())
  profiles.ensureBuiltinProfiles()
  const sessions = new SessionsStore(db.db, storeDeps())
  const pty = fakePty()
  const projects = fakeProjects(opts.worktrees)
  const events = fakeEvents()
  const notified: { id: string; status: string; reveal: boolean }[] = []
  const log = recordingLog()
  const decorators = new LaunchDecoratorRegistry()
  const tempDirs = new SessionTempDirs(join(db.dir, 'agents', 'tmp'))
  const resolve = createResolve(async (cmd) => (cmd === 'missing' ? null : `/bin/${cmd}`))
  const contextFactory = createLaunchContextFactory({ tempDirs, getShellEnv: pty.pty.getShellEnv })
  const service = new AgentSessionsServiceImpl({
    profiles,
    sessions,
    projects: projects.projects,
    events: events.bus,
    notify: (s, reveal) => void notified.push({ id: s.id, status: s.status, reveal }),
    t: tUntitled,
    decorators,
    contextFactory,
    tempDirs,
    log,
  })
  const terminal = createTerminalModeHandler({
    pty: pty.pty,
    pipeline: { providers, decorators, resolve, log },
    contextFactory,
    tempDirs,
    log,
  })
  service.registerModeHandler(TERMINAL_MODE, terminal)
  return { service, terminal, profiles, sessions, pty, projects, events, notified, log, tempDirs, providers }
}
export type ServiceHarness = ReturnType<typeof makeService>
