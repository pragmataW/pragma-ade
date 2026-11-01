import {
  type AgentSession,
  isRunningStatus,
  type ModeStartRequest,
  SESSION_STATUS,
  STOP_SIGNAL,
  type StopSignal,
} from '@pragma/module-agents/contract'
import type { ChatEvent } from '../contract'
import { ChatSessionController, type ChatSnapshot, type ControllerDeps } from './controller'

export type RegistryDeps = Omit<ControllerDeps, 'sessionId'>

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
    const history = await this.#history(session)
    const again = this.#controllers.get(id)
    if (again) return again
    const c = this.#create(id)
    const status = isRunningStatus(session.status) ? SESSION_STATUS.exited : session.status
    c.initDormant(history, status, {
      providerId: session.providerId,
      ...(session.externalSessionId ? { externalSessionId: session.externalSessionId } : {}),
    })
    return c
  }

  async #history(session: AgentSession): Promise<ChatEvent[]> {
    if (!session.externalSessionId || !session.profileId) return []
    const profile = await this.#d.agents.getProfile(session.profileId)
    const capability = profile ? this.#d.resolveCapability(profile) : undefined
    const worktreePath = await this.#d.agents.getWorktreePath(session.worktreeId)
    if (!profile || !capability?.loadHistory || !worktreePath) return []
    try {
      return await capability.loadHistory({
        profile,
        worktreePath,
        env: {},
        externalSessionId: session.externalSessionId,
      })
    } catch (e) {
      this.#d.log.warn(`chat ${session.id}: history load failed`, e)
      return []
    }
  }

  async snapshot(id: string): Promise<ChatSnapshot> {
    return (await this.open(id)).snapshot()
  }

  /** Mode-handler `start`: the startup runs in the background (the handshake can take up to the startup timeout). */
  attach(req: ModeStartRequest): ChatSessionController {
    const c = this.#controllers.get(req.session.id) ?? this.#create(req.session.id)
    void c.attach(req)
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
