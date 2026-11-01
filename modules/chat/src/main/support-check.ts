import { type ChatCapability, type ChatSupport, UNSUPPORTED_REASON } from '../contract'
import type { ChatAgentsApi } from './agents-adapter'
import type { SupportCache } from './support-cache'

/** First that applies: no capability → disabled profile → cached startup failure → the capability's own check. */
export async function checkChatSupport(
  deps: {
    agents: Pick<ChatAgentsApi, 'getProfile'>
    resolveCapability(p: { providerId: string }): ChatCapability | undefined
    supportCache: SupportCache
  },
  profileId: string,
): Promise<ChatSupport> {
  const profile = await deps.agents.getProfile(profileId)
  const capability = profile ? deps.resolveCapability(profile) : undefined
  if (!profile || !capability) return { ok: false, reasonKey: UNSUPPORTED_REASON.noCapability }
  if (!profile.enabled) return { ok: false, reasonKey: UNSUPPORTED_REASON.profileDisabled }
  const cached = deps.supportCache.get(profile)
  if (cached) return { ok: false, ...cached }
  return capability.checkSupport(profile)
}
