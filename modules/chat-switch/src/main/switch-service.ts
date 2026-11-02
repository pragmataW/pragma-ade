import {
  type AgentProfile,
  type AgentSession,
  type AgentSessionsService,
  agentsErrorKey,
} from '@pragma/module-agents/contract'
import type { ChatSupport, RetainedServer } from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { CHAT_CAPABILITY, CHAT_SWITCH_KEY_PREFIX, RESUME_CAPABILITY, SWITCH_ERROR, switchErrorKey } from '../constants'
import {
  type ChangedEvent,
  type ChatSwitchService,
  type ExternalSessionGuard,
  SWITCH_PHASE,
  SWITCH_TARGET,
  type SwitchEligibility,
  type SwitchResult,
  type SwitchTarget,
} from '../contract'
import { type EligibilityInput, evaluateSwitch, NO_CHAT_CAPABILITY } from './eligibility'

export interface SwitchServiceDeps {
  agents: Pick<AgentSessionsService, 'getSession' | 'getProfile' | 'relaunchSession'>
  providers: Pick<MainContext['providers'], 'capability'>
  guard: ExternalSessionGuard
  worktreePath(worktreeId: string): Promise<string | null>
  publish(e: ChangedEvent): void
  log: Pick<Logger, 'info' | 'warn'>
  /** Test hook `chat-switch.test.disableRetain`: skip the serve retain (standalone path). */
  retainDisabled?(): boolean
}

/** The service plus the state its wiring needs (in-flight ids and retained serve leases). */
export interface SwitchServiceImpl extends ChatSwitchService {
  isSwitching(sessionId: string): boolean
  /** Releases (and forgets) the serve lease kept for a session that continued in a terminal. */
  releaseServe(sessionId: string): Promise<void>
  releaseAllServes(): Promise<void>
}

class SwitchError extends Error {}

/** The `chat-switch:*` or `agents:errors.*` key an error carries, else `startFailed`. */
function errorKeyOf(e: unknown): string {
  const agents = agentsErrorKey(e)
  if (agents) return agents.key
  const message = e instanceof Error ? e.message : ''
  return message.startsWith(CHAT_SWITCH_KEY_PREFIX) ? message : switchErrorKey(SWITCH_ERROR.startFailed)
}

export function createChatSwitchService(d: SwitchServiceDeps): SwitchServiceImpl {
  const inFlight = new Set<string>()
  const serveLeases = new Map<string, RetainedServer>()

  async function chatSupportOf(
    session: AgentSession,
    profile: AgentProfile | null,
  ): Promise<EligibilityInput['chatSupport']> {
    const chat = d.providers.capability(session.providerId, CHAT_CAPABILITY)
    if (!chat || !profile) return NO_CHAT_CAPABILITY
    const support: ChatSupport = await chat.checkSupport(profile)
    return support.ok ? { ok: true } : { ok: false, reasonKey: support.reasonKey }
  }

  async function load(sessionId: string) {
    const session = await d.agents.getSession(sessionId)
    if (!session) throw new SwitchError(switchErrorKey(SWITCH_ERROR.startFailed))
    const profile = session.profileId ? await d.agents.getProfile(session.profileId) : null
    return { session, profile }
  }

  async function evaluate(
    { session, profile }: Awaited<ReturnType<typeof load>>,
    switching: boolean,
  ): Promise<SwitchEligibility> {
    const resume = d.providers.capability(session.providerId, RESUME_CAPABILITY)
    const ext = session.externalSessionId
    return evaluateSwitch({
      session,
      hasResume: resume !== undefined,
      canResumeInChat: resume?.canResumeInChat ?? false,
      chatSupport: session.mode === SWITCH_TARGET.chat ? NO_CHAT_CAPABILITY : await chatSupportOf(session, profile),
      busyOwnerSessionId: ext ? d.guard.ownerOf({ providerId: session.providerId, externalSessionId: ext }) : undefined,
      switching,
    })
  }

  const eligibility = async (sessionId: string): Promise<SwitchEligibility> =>
    evaluate(await load(sessionId), inFlight.has(sessionId))

  /** chat → terminal only: a live chat serve hosting the session is kept for the TUI (`--server`). */
  async function retainServe(session: AgentSession, profile: AgentProfile | null, externalSessionId: string) {
    const chat = d.providers.capability(session.providerId, CHAT_CAPABILITY)
    if (d.retainDisabled?.() || !profile || !chat?.retainServer) return undefined
    const worktreePath = await d.worktreePath(session.worktreeId)
    if (!worktreePath) return undefined
    const lease = await chat.retainServer({ worktreePath, profile, externalSessionId })
    if (lease) serveLeases.set(session.id, lease)
    return lease?.url
  }

  async function releaseServe(sessionId: string): Promise<void> {
    const lease = serveLeases.get(sessionId)
    serveLeases.delete(sessionId)
    await lease?.release()
  }

  async function run(sessionId: string, target: SwitchTarget): Promise<SwitchResult> {
    const loaded = await load(sessionId)
    const { session, profile } = loaded
    // this switch is already in flight: evaluate as if it were not
    const verdict = (await evaluate(loaded, false))[target]
    if (!verdict.ok) return { ok: false, errorKey: verdict.reasonKey }
    const externalSessionId = session.externalSessionId ?? ''
    const claim = d.guard.claim({ providerId: session.providerId, externalSessionId }, sessionId)
    if (!claim.ok) return { ok: false, errorKey: switchErrorKey(SWITCH_ERROR.busy) }
    d.publish({ sessionId, phase: SWITCH_PHASE.switching })
    try {
      const serverUrl =
        target === SWITCH_TARGET.terminal ? await retainServe(session, profile, externalSessionId) : undefined
      const resume = { externalSessionId, ...(serverUrl ? { serverUrl } : {}) }
      const s = await d.agents.relaunchSession(sessionId, { mode: target, resume })
      d.publish({ sessionId, phase: SWITCH_PHASE.done })
      return { ok: true, sessionId: s.id }
    } catch (e) {
      await releaseServe(sessionId).catch(() => undefined)
      d.guard.release(sessionId)
      const errorKey = errorKeyOf(e)
      d.log.warn(`chat-switch: ${sessionId} → ${target} failed (${errorKey})`, e)
      d.publish({ sessionId, phase: SWITCH_PHASE.failed, errorKey })
      return { ok: false, errorKey }
    }
  }

  return {
    eligibility,
    async switchTo(sessionId, target) {
      if (inFlight.has(sessionId)) return { ok: false, errorKey: switchErrorKey(SWITCH_ERROR.inProgress) }
      inFlight.add(sessionId)
      try {
        return await run(sessionId, target)
      } catch (e) {
        return { ok: false, errorKey: errorKeyOf(e) }
      } finally {
        inFlight.delete(sessionId)
      }
    },
    isSwitching: (sessionId) => inFlight.has(sessionId),
    releaseServe,
    async releaseAllServes() {
      await Promise.allSettled([...serveLeases.keys()].map(releaseServe))
    },
  }
}
