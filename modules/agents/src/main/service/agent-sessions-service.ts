import type { Worktree } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { KILL_CONFIRM_MS, STOP_GRACE_MS } from '../../constants'
import {
  AGENTS_ERROR,
  type AgentProfile,
  type AgentSession,
  type AgentSessionModeHandler,
  type AgentSessionsService,
  AgentsError,
  agentSessionExited,
  agentSessionStarted,
  agentSessionUpdated,
  isRunningStatus,
  type LaunchDecorator,
  type LaunchEnvContext,
  type RelaunchOptions,
  type Resume,
  relaunchOptionsSchema,
  SESSION_STATUS,
  type SessionPatch,
  STOP_SIGNAL,
  type StartSessionInput,
  sessionPatchSchema,
  startSessionInputSchema,
} from '../../contract'
import type { LaunchContextFactory } from '../launch/context'
import type { LaunchDecoratorRegistry } from '../launch/decorators'
import { runEnvPipeline } from '../launch/launch-pipeline'
import type { SessionTempDirs } from '../launch/session-temp'
import { errorSessionPatch, toAgentsError } from '../lib/errors'
import type { ProfilesStore } from '../profiles/profiles-store'
import type { SessionRecord, SessionsStore, StorePatch } from '../sessions/sessions-store'
import { deriveSessionTitle } from '../sessions/title'
import type { ProjectsAccess } from './deps'

export interface AgentSessionsDeps {
  profiles: ProfilesStore
  sessions: SessionsStore
  projects: ProjectsAccess
  events: Pick<MainContext['events'], 'emit'>
  /** Main → renderer: publish the session (`reveal` selects its tab). */
  notify(session: AgentSession, reveal: boolean): void
  t(key: string, options?: Record<string, unknown>): string
  decorators: LaunchDecoratorRegistry
  contextFactory: LaunchContextFactory
  tempDirs: Pick<SessionTempDirs, 'remove'>
  log: Logger
  now?: () => number
}

interface LaunchOptions {
  initialPrompt?: string
  resume?: Resume
}

export class DuplicateModeError extends Error {}

const SESSION_KEYS = (s: AgentSession) => Object.keys(s) as (keyof AgentSession)[]
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Resolves true when `p` settles within `ms`. */
async function within(p: Promise<void>, ms: number): Promise<boolean> {
  return Promise.race([p.then(() => true), sleep(ms).then(() => false)])
}

/** `AgentSessionsService` (§7, §10.3): profiles, sessions, mode handlers, decorators, confirmed stops. */
export class AgentSessionsServiceImpl implements AgentSessionsService {
  readonly #d: AgentSessionsDeps
  readonly #now: () => number
  readonly #handlers = new Map<string, AgentSessionModeHandler>()
  /** Sessions whose process was spawned in this main-process lifetime. */
  readonly #spawned = new Set<string>()
  readonly #exitWaiters = new Map<string, (() => void)[]>()
  readonly #stopping = new Map<string, Promise<void>>()

  constructor(deps: AgentSessionsDeps) {
    this.#d = deps
    this.#now = deps.now ?? Date.now
  }

  // ── mapping and persistence ────────────────────────────────────────────

  #toSession(r: SessionRecord): AgentSession {
    const { storedTitle, ...rest } = r
    return {
      ...rest,
      title: storedTitle ?? this.#d.t('agents:session.untitled', { n: r.ordinal }),
      attachable: this.#spawned.has(r.id) && r.ptyId !== null,
    }
  }

  #record(id: string): SessionRecord {
    const r = this.#d.sessions.get(id)
    if (!r) throw new AgentsError(AGENTS_ERROR.sessionNotFound, { id })
    return r
  }

  #publish(before: AgentSession | null, session: AgentSession, reveal: boolean): AgentSession {
    const changed = SESSION_KEYS(session).filter((k) => !before || before[k] !== session[k])
    this.#d.events.emit(agentSessionUpdated, { session, changed })
    this.#d.notify(session, reveal)
    return session
  }

  /** Persists a patch and emits `agentSession.updated` + the renderer notification. */
  #commit(id: string, patch: StorePatch, reveal = false): AgentSession {
    const before = this.#toSession(this.#record(id))
    return this.#publish(before, this.#toSession(this.#d.sessions.update(id, patch)), reveal)
  }

  #handler(mode: string): AgentSessionModeHandler {
    const h = this.#handlers.get(mode)
    if (!h) throw new AgentsError(AGENTS_ERROR.modeUnavailable, { mode })
    return h
  }

  async #worktree(id: string): Promise<Worktree> {
    const w = await this.#d.projects.getWorktree(id)
    if (!w || w.archivedAt !== null) throw new AgentsError(AGENTS_ERROR.worktreeNotFound, { id })
    return w
  }

  #profile(id: string | null | undefined): AgentProfile {
    const p = id ? this.#d.profiles.get(id) : this.#d.profiles.getDefault()
    if (!p) throw new AgentsError(id ? AGENTS_ERROR.profileNotFound : AGENTS_ERROR.noDefaultProfile, { id: id ?? '' })
    if (!p.enabled) throw new AgentsError(AGENTS_ERROR.profileDisabled, { id: p.id })
    return p
  }

  async #createWorktree(source: Worktree, spec: { branch: string; baseBranch?: string }): Promise<Worktree> {
    try {
      return await this.#d.projects.createWorktree({ projectId: source.projectId, ...spec })
    } catch (error) {
      throw toAgentsError(error, AGENTS_ERROR.worktreeCreateFailed)
    }
  }

  // ── launching ───────────────────────────────────────────────────────────

  async startSession(input: StartSessionInput): Promise<AgentSession> {
    const parsed = startSessionInputSchema.parse(input)
    const handler = this.#handler(parsed.mode)
    const source = await this.#worktree(parsed.worktreeId)
    const profile = this.#profile(parsed.profileId)
    const worktree = parsed.newWorktree ? await this.#createWorktree(source, parsed.newWorktree) : source
    const row = this.#d.sessions.insert({
      worktreeId: worktree.id,
      profileId: profile.id,
      providerId: profile.providerId,
      mode: parsed.mode,
      title: deriveSessionTitle(parsed.initialPrompt),
    })
    this.#publish(null, this.#toSession(row), true)
    return this.#launchRow(row, handler, profile, worktree, parsed)
  }

  /** Runs the mode handler for a `starting` row; failures become an error session (returned, not thrown). */
  async #launchRow(
    row: SessionRecord,
    handler: AgentSessionModeHandler,
    profile: AgentProfile,
    worktree: Worktree,
    opts: LaunchOptions,
  ): Promise<AgentSession> {
    if (!profile.available)
      return this.#fail(row.id, new AgentsError(AGENTS_ERROR.providerUnavailable, { providerId: profile.providerId }))
    let reported = false
    const reportExit = (exitCode: number | null) => {
      if (reported) return
      reported = true
      this.#onExit(row.id, exitCode)
    }
    try {
      const session = this.#toSession(row)
      const { ptyId } = await handler.start({ session, profile, worktree, ...opts, reportExit })
      this.#spawned.add(row.id)
      const started = this.#commit(row.id, { ptyId })
      this.#d.events.emit(agentSessionStarted, {
        sessionId: row.id,
        worktreeId: row.worktreeId,
        profileId: row.profileId,
        providerId: row.providerId,
        mode: started.mode,
        ptyId,
      })
      return started
    } catch (error) {
      return this.#fail(row.id, toAgentsError(error))
    }
  }

  #fail(id: string, error: AgentsError): AgentSession {
    this.#d.log.warn(`session ${id} failed to start: ${error.message}`)
    return this.#commit(id, errorSessionPatch(error, this.#now()))
  }

  #onExit(id: string, exitCode: number | null): void {
    const r = this.#d.sessions.get(id)
    if (!r) return
    this.#commit(id, { status: SESSION_STATUS.exited, exitCode, endedAt: this.#now() })
    this.#d.events.emit(agentSessionExited, { sessionId: id, worktreeId: r.worktreeId, exitCode })
    for (const resolve of this.#exitWaiters.get(id) ?? []) resolve()
    this.#exitWaiters.delete(id)
  }

  async relaunchSession(id: string, opts: RelaunchOptions = {}): Promise<AgentSession> {
    const parsed = relaunchOptionsSchema.parse(opts)
    const current = this.#record(id)
    await this.stopSession(id)
    const mode = parsed.mode ?? current.mode
    const handler = this.#handler(mode)
    const profile = this.#profile(current.profileId)
    const worktree = await this.#worktree(current.worktreeId)
    this.#spawned.delete(id)
    this.#commit(
      id,
      {
        status: SESSION_STATUS.starting,
        mode,
        ptyId: null,
        exitCode: null,
        endedAt: null,
        closedAt: null,
        ...NO_ERROR,
      },
      true,
    )
    return this.#launchRow(this.#record(id), handler, profile, worktree, parsed)
  }

  // ── stopping ────────────────────────────────────────────────────────────

  #waitExit(id: string): Promise<void> {
    return new Promise((resolve) => {
      this.#exitWaiters.set(id, [...(this.#exitWaiters.get(id) ?? []), resolve])
    })
  }

  async stopSession(id: string): Promise<void> {
    const r = this.#record(id)
    if (!isRunningStatus(r.status)) return
    const inFlight = this.#stopping.get(id)
    if (inFlight) return inFlight
    const stop = this.#escalate(this.#toSession(r)).finally(() => this.#stopping.delete(id))
    this.#stopping.set(id, stop)
    return stop
  }

  /** 'term' → STOP_GRACE_MS → 'kill' → KILL_CONFIRM_MS; only a reported exit resolves. */
  async #escalate(session: AgentSession): Promise<void> {
    const handler = this.#handler(session.mode)
    const exited = this.#waitExit(session.id)
    await handler.stop(session, STOP_SIGNAL.term)
    if (await within(exited, STOP_GRACE_MS)) return
    await handler.stop(session, STOP_SIGNAL.kill)
    if (await within(exited, KILL_CONFIRM_MS)) return
    throw new AgentsError(AGENTS_ERROR.stopFailed)
  }

  async closeSession(id: string): Promise<void> {
    await this.stopSession(id)
    this.#commit(id, { closedAt: this.#now() })
    await this.#d.tempDirs.remove(id)
  }

  async focusSession(id: string): Promise<void> {
    this.#record(id)
    this.#commit(id, { lastFocusedAt: this.#now() })
  }

  async updateSession(id: string, patch: SessionPatch): Promise<AgentSession> {
    const parsed = sessionPatchSchema.parse(patch)
    this.#record(id)
    return this.#commit(id, parsed)
  }

  // ── queries ─────────────────────────────────────────────────────────────

  async listProfiles(opts?: { launchableOnly?: boolean }): Promise<AgentProfile[]> {
    return this.#d.profiles.list(opts)
  }

  async getProfile(id: string): Promise<AgentProfile | null> {
    return this.#d.profiles.get(id)
  }

  async listSessions(worktreeId: string, opts?: { includeClosed?: boolean }): Promise<AgentSession[]> {
    return this.#d.sessions.listByWorktree(worktreeId, opts).map((r) => this.#toSession(r))
  }

  async getSession(id: string): Promise<AgentSession | null> {
    const r = this.#d.sessions.get(id)
    return r ? this.#toSession(r) : null
  }

  async getLastFocusedSession(worktreeId: string): Promise<AgentSession | null> {
    const r = this.#d.sessions.lastFocusedRunning(worktreeId)
    return r ? this.#toSession(r) : null
  }

  // ── extension points ────────────────────────────────────────────────────

  registerModeHandler(mode: string, handler: AgentSessionModeHandler): () => void {
    if (this.#handlers.has(mode)) throw new DuplicateModeError(`mode handler ${mode} is already registered`)
    this.#handlers.set(mode, handler)
    return () => {
      if (this.#handlers.get(mode) === handler) this.#handlers.delete(mode)
    }
  }

  registerLaunchDecorator(decorator: LaunchDecorator): () => void {
    return this.#d.decorators.register(decorator)
  }

  async buildLaunchEnv(ctx: LaunchEnvContext): Promise<Record<string, string>> {
    const r = this.#record(ctx.sessionId)
    const profile = this.#d.profiles.get(r.profileId ?? '')
    if (!profile) throw new AgentsError(AGENTS_ERROR.profileNotFound, { id: r.profileId ?? '' })
    const worktree = await this.#worktree(r.worktreeId)
    const launch = await this.#d.contextFactory({ session: r, profile, worktree, resume: ctx.resume })
    return runEnvPipeline({ decorators: this.#d.decorators, log: this.#d.log }, launch)
  }

  listModes(): string[] {
    return [...this.#handlers.keys()]
  }

  /** Startup: rows still running from a previous run become `exited` (their ptys are gone). */
  async markAllEndedOnStartup(): Promise<void> {
    const ids = this.#d.sessions.sweepStale()
    if (ids.length > 0) this.#d.log.info(`marked ${ids.length} stale session(s) as exited`)
  }
}

const NO_ERROR: StorePatch = { errorCode: null, errorMessage: null }
