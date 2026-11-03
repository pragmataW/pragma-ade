import {
  type AgentProfile,
  type AgentSession,
  isRunningStatus,
  type ModeStartRequest,
  SESSION_STATUS,
  STOP_SIGNAL,
  type StopSignal,
} from '@pragma/module-agents/contract'
import { HISTORY_LOAD_FAILED_KEY } from '../constants'
import {
  type ChatCapability,
  type ChatEvent,
  type ChatHistoryContext,
  type ChatOptionDescriptor,
  ERROR_CODE,
  EVENT_KIND as K,
} from '../contract'
import { ChatSessionController, type ChatSnapshot, type ControllerDeps } from './controller'
import { fallbackOptions } from './session-options-store'

export type RegistryDeps = Omit<ControllerDeps, 'sessionId'>

interface HistorySource {
  profile: AgentProfile
  capability: ChatCapability | undefined
}

export class UnknownChatSessionError extends Error {}

/** Controllers by session id: live ones (attached by the mode handler) and dormant ones (history only). */
export class ChatSessionRegistry {
  readonly #d: RegistryDeps
  readonly #controllers = new Map<string, ChatSessionController>()

  constructor(deps: RegistryDeps) {
    this.#d = deps
  }

  get(id: string): ChatSessionController | undefined {
    return this.#controllers.get(id)
  }

  #create(id: string): ChatSessionController {
    const c = new ChatSessionController({ ...this.#d, sessionId: id })
    this.#controllers.set(id, c)
    return c
  }

  /** The live controller, else a dormant one rebuilt from the provider's transcript (or empty). */
  async open(id: string): Promise<ChatSessionController> {
    const existing = this.#controllers.get(id)
    if (existing) return existing
    const session = await this.#d.agents.getSession(id)
    if (!session) throw new UnknownChatSessionError(`unknown chat session ${id}`)
    const source = await this.#source(session)
    const history = await this.#history(session, source)
    const again = this.#controllers.get(id)
    if (again) return again
    const c = this.#create(id)
    const status = isRunningStatus(session.status) ? SESSION_STATUS.exited : session.status
    c.initDormant(history, status, {
      providerId: session.providerId,
      ...(session.externalSessionId ? { externalSessionId: session.externalSessionId } : {}),
      ...(source ? { profileId: source.profile.id, fallbackOptions: this.#fallbackOptions(source) } : {}),
    })
    return c
  }

  async #source(session: AgentSession): Promise<HistorySource | undefined> {
    const profile = session.profileId ? await this.#d.agents.getProfile(session.profileId) : undefined
    return profile ? { profile, capability: this.#d.resolveCapability(profile) } : undefined
  }

  /** The profile's last-known options, else (or completed by) the provider's static defaults. */
  #fallbackOptions({ profile, capability }: HistorySource): ChatOptionDescriptor[] {
    return fallbackOptions(this.#d.optionsStore?.latest(profile.id), capability?.defaultOptions?.(profile))
  }

  async #history(session: AgentSession, source: HistorySource | undefined): Promise<ChatEvent[]> {
    if (!session.externalSessionId || !source?.capability?.loadHistory) return []
    const worktreePath = await this.#d.agents.getWorktreePath(session.worktreeId)
    if (!worktreePath) return []
    return this.#load(session.id, source.capability, {
      profile: source.profile,
      worktreePath,
      env: {},
      externalSessionId: session.externalSessionId,
    })
  }

  /** The provider's transcript of the conversation; never rejects. */
  async #load(id: string, capability: ChatCapability | undefined, ctx: ChatHistoryContext): Promise<ChatEvent[]> {
    if (!capability?.loadHistory) return []
    try {
      return await capability.loadHistory(ctx)
    } catch (e) {
      // Non-fatal: the session still opens (toolbar from its saved options, resume by its external id).
      this.#d.log.warn(`chat ${id}: history load failed`, e)
      return [
        { kind: K.error, code: ERROR_CODE.unknown, message: HISTORY_LOAD_FAILED_KEY, detail: String(e), fatal: false },
      ]
    }
  }

  /**
   * A resume no controller shows yet (e.g. a terminal session continued in chat, or a start racing the view's
   * `open`): the conversation so far, else the transcript would hold only the live events.
   */
  #resumedHistory(req: ModeStartRequest): Promise<ChatEvent[]> | undefined {
    const externalSessionId = req.resume?.externalSessionId
    if (!externalSessionId) return undefined
    return this.#load(req.session.id, this.#d.resolveCapability(req.profile), {
      profile: req.profile,
      worktreePath: req.worktree.path,
      env: {},
      externalSessionId,
    })
  }

  async snapshot(id: string): Promise<ChatSnapshot> {
    return (await this.open(id)).snapshot()
  }

  /** Mode-handler `start`: the startup runs in the background (the handshake can take up to the startup timeout). */
  attach(req: ModeStartRequest): ChatSessionController {
    const existing = this.#controllers.get(req.session.id)
    const c = existing ?? this.#create(req.session.id)
    void c.attach(req, existing ? undefined : this.#resumedHistory(req))
    return c
  }

  /** Mode-handler `stop`; exit confirmation only via `reportExit`. */
  async stop(session: AgentSession, signal: StopSignal): Promise<void> {
    const c = this.#controllers.get(session.id)
    if (!c) return
    await (signal === STOP_SIGNAL.kill ? c.kill() : c.close())
  }

  async closeAll(): Promise<void> {
    await Promise.allSettled([...this.#controllers.values()].map((c) => c.close()))
  }
}
