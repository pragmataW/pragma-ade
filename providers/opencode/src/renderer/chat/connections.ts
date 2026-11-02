/**
 * Settings › OpenCode RPC (`ChatCapability.settingsCall`): one source of truth for main (answers) and renderer (asks).
 * No React, no Node.
 */
import { z } from '@pragma/sdk'

export const CONNECTION_OPS = {
  list: 'list',
  connectKey: 'connectKey',
  oauthStart: 'oauthStart',
  oauthStatus: 'oauthStatus',
  oauthComplete: 'oauthComplete',
  oauthCancel: 'oauthCancel',
  remove: 'remove',
} as const
/** The RPC's discriminator. */
export const OP_KEY = 'op'

const integration = { integrationID: z.string().min(1) }
const attempt = { ...integration, attemptID: z.string().min(1) }

export const connectionRequestSchema = z.discriminatedUnion(OP_KEY, [
  z.object({ op: z.literal(CONNECTION_OPS.list) }),
  z.object({ op: z.literal(CONNECTION_OPS.connectKey), ...integration, key: z.string().min(1) }),
  z.object({ op: z.literal(CONNECTION_OPS.oauthStart), ...integration, methodID: z.string().min(1) }),
  z.object({ op: z.literal(CONNECTION_OPS.oauthStatus), ...attempt }),
  z.object({ op: z.literal(CONNECTION_OPS.oauthComplete), ...attempt, code: z.string().optional() }),
  z.object({ op: z.literal(CONNECTION_OPS.oauthCancel), ...attempt }),
  z.object({ op: z.literal(CONNECTION_OPS.remove), credentialID: z.string().min(1) }),
])
export type ConnectionRequest = z.infer<typeof connectionRequestSchema>

/** Notes shown on a provider (i18n keys under `opencode:chatUi.connections.notice.*`). */
export const PROVIDER_NOTICES = ['keyOnly'] as const

export const providerConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Saved credentials (removable) and env variables OpenCode found. */
  credentials: z.array(z.object({ id: z.string(), label: z.string(), method: z.string() })),
  env: z.array(z.string()),
  /** Ways to connect: an API key and/or OAuth / device-code methods. */
  key: z.boolean(),
  oauth: z.array(z.object({ id: z.string(), label: z.string() })),
  /** Usable without a connection (e.g. OpenCode's free models). */
  free: z.boolean(),
  notice: z.enum(PROVIDER_NOTICES).optional(),
})
export type ProviderConnection = z.infer<typeof providerConnectionSchema>
export const connectionListSchema = z.object({ providers: z.array(providerConnectionSchema) })
export type ConnectionList = z.infer<typeof connectionListSchema>

export const OAUTH_MODES = ['auto', 'code'] as const
export const OAUTH_MODE = { auto: 'auto', code: 'code' } as const
export const oauthAttemptSchema = z.object({
  attemptID: z.string(),
  url: z.string(),
  instructions: z.string(),
  /** `code`: the user pastes a code shown by the provider; `auto`: the flow completes by itself. */
  mode: z.enum(OAUTH_MODES),
})
export type OauthAttempt = z.infer<typeof oauthAttemptSchema>

export const OAUTH_STATUSES = ['pending', 'complete', 'failed', 'expired'] as const
export const OAUTH_STATUS = { pending: 'pending', complete: 'complete', failed: 'failed', expired: 'expired' } as const
export const oauthStatusSchema = z.object({ status: z.enum(OAUTH_STATUSES), message: z.string().optional() })
export type OauthStatus = z.infer<typeof oauthStatusSchema>

export const okSchema = z.object({ ok: z.literal(true) })
