import { defineBridgeNamespace } from '@pragma/module-bridge/contract'
import { z } from '@pragma/sdk'
import { AGENT_BRIDGE_NAMESPACE, AGENT_HOOK_REQUEST, HOOK_ID_MAX_CHARS, PROVIDER_ID_MAX_CHARS } from './constants'

/** `agent.hookEvent` payload: the raw provider event, parsed by that provider's `status` capability. */
export const AgentHookEventInputSchema = z.object({
  sessionId: z.string().min(1).max(HOOK_ID_MAX_CHARS),
  providerId: z.string().min(1).max(PROVIDER_ID_MAX_CHARS),
  event: z.unknown(),
})
export type AgentHookEventInput = z.infer<typeof AgentHookEventInputSchema>

export const agentBridge = defineBridgeNamespace({
  name: AGENT_BRIDGE_NAMESPACE,
  requests: { [AGENT_HOOK_REQUEST]: { input: AgentHookEventInputSchema, output: z.object({ accepted: z.boolean() }) } },
  events: {},
})
