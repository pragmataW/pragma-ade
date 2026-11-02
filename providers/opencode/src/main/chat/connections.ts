import { homedir } from 'node:os'
import { z } from '@pragma/sdk'
import {
  type ConnectionList,
  type ConnectionRequest,
  connectionRequestSchema,
  OAUTH_STATUS,
  type OauthAttempt,
  type OauthStatus,
  CONNECTION_OPS as OP,
  oauthAttemptSchema,
  oauthStatusSchema,
  type ProviderConnection,
} from '../../renderer/chat/connections'
import {
  CONNECTION_TYPES,
  INTEGRATION_METHODS,
  KEY_ONLY_INTEGRATIONS,
  SETTINGS_PROFILE,
  SETTINGS_STARTUP_TIMEOUT_MS,
} from './constants'
import { type IntegrationInfo, integrationInfoSchema, listOf, providerInfoSchema } from './schemas'
import type { ConnectionPool, OpencodeConnection } from './server/connection'
import type { Lease } from './server/pool'

const located = <T extends z.ZodType>(data: T) => z.looseObject({ data })

/** One integration as the settings page shows it. */
export function providerConnectionOf(i: IntegrationInfo, freeProviders: ReadonlySet<string>): ProviderConnection {
  const credentials = i.connections.flatMap((c) =>
    c.type === CONNECTION_TYPES.credential && c.id
      ? [{ id: c.id, label: c.label ?? c.id, method: c.method ?? '' }]
      : [],
  )
  const env = i.connections.flatMap((c) => (c.type === CONNECTION_TYPES.env && c.name ? [c.name] : []))
  const oauth = i.methods.flatMap((m) =>
    m.type === INTEGRATION_METHODS.oauth && m.id ? [{ id: m.id, label: m.label ?? m.id }] : [],
  )
  return {
    id: i.id,
    name: i.name,
    credentials,
    env,
    key: i.methods.some((m) => m.type === INTEGRATION_METHODS.key),
    oauth: (KEY_ONLY_INTEGRATIONS as readonly string[]).includes(i.id) ? [] : oauth,
    free: freeProviders.has(i.id),
    ...((KEY_ONLY_INTEGRATIONS as readonly string[]).includes(i.id) ? { notice: 'keyOnly' as const } : {}),
  }
}

export class ConnectionRequestError extends Error {}

/**
 * Settings › OpenCode: lists the model providers OpenCode can connect to (`integration.list`) and connects them by API
 * key or OAuth / device code, through a `serve` of the default `opencode` command in the home directory (credentials
 * are global to OpenCode). An OAuth attempt keeps its server leased until it completes, fails or is cancelled.
 */
export function createConnections(o: {
  pool: ConnectionPool
  env: () => Promise<Record<string, string>>
  command: string
  args?: readonly string[]
}) {
  const attempts = new Map<string, Lease<OpencodeConnection>>()
  const acquire = async () =>
    o.pool.acquire({
      profile: { id: SETTINGS_PROFILE, command: o.command, args: [...(o.args ?? [])] },
      worktreePath: homedir(),
      env: await o.env(),
      startupTimeoutMs: SETTINGS_STARTUP_TIMEOUT_MS,
    })
  const withServer = async <T>(run: (c: OpencodeConnection) => Promise<T>): Promise<T> => {
    const lease = await acquire()
    try {
      return await run(lease.resource)
    } finally {
      lease.release()
    }
  }
  const endAttempt = (attemptID: string) => {
    attempts.get(attemptID)?.release()
    attempts.delete(attemptID)
  }

  async function list(c: OpencodeConnection): Promise<ConnectionList> {
    const [integrations, providers] = await Promise.all([c.client.integration.list(), c.client.provider.list()])
    const free = new Set(
      listOf(providerInfoSchema)
        .parse(providers)
        .data.filter((p) => Boolean(p.settings?.apiKey))
        .map((p) => p.integrationID ?? p.id),
    )
    const all = listOf(integrationInfoSchema)
      .parse(integrations)
      .data.map((i) => providerConnectionOf(i, free))
    return { providers: all.sort((a, b) => a.name.localeCompare(b.name)) }
  }

  async function oauthStart(r: Extract<ConnectionRequest, { op: 'oauthStart' }>): Promise<OauthAttempt> {
    const lease = await acquire()
    try {
      const raw = await lease.resource.client.integration.oauth.connect(r)
      const attempt = located(oauthAttemptSchema).parse(raw).data
      attempts.set(attempt.attemptID, lease)
      return attempt
    } catch (e) {
      lease.release()
      throw e
    }
  }

  async function oauthStatus(r: Extract<ConnectionRequest, { op: 'oauthStatus' }>): Promise<OauthStatus> {
    const lease = attempts.get(r.attemptID)
    if (!lease) return { status: OAUTH_STATUS.expired }
    const raw = await lease.resource.client.integration.oauth.status(r)
    const status = located(oauthStatusSchema).parse(raw).data
    if (status.status !== OAUTH_STATUS.pending) endAttempt(r.attemptID)
    return status
  }

  const ok = { ok: true } as const
  return {
    async call(request: unknown): Promise<unknown> {
      const parsed = connectionRequestSchema.safeParse(request)
      if (!parsed.success) throw new ConnectionRequestError(parsed.error.message)
      const r = parsed.data
      switch (r.op) {
        case OP.list:
          return withServer(list)
        case OP.keyConnect:
          await withServer((c) => c.client.integration.connect.key({ integrationID: r.integrationID, key: r.key }))
          return ok
        case OP.oauthStart:
          return oauthStart(r)
        case OP.oauthStatus:
          return oauthStatus(r)
        case OP.oauthComplete: {
          const lease = attempts.get(r.attemptID)
          if (!lease) throw new ConnectionRequestError(OAUTH_STATUS.expired)
          await lease.resource.client.integration.oauth.complete(r)
          endAttempt(r.attemptID)
          return ok
        }
        case OP.oauthCancel: {
          await attempts.get(r.attemptID)?.resource.client.integration.oauth.cancel(r)
          endAttempt(r.attemptID)
          return ok
        }
        case OP.remove:
          await withServer((c) => c.client.credential.remove({ credentialID: r.credentialID }))
          return ok
        default: {
          const never: never = r
          return never
        }
      }
    },
    dispose(): void {
      for (const id of [...attempts.keys()]) endAttempt(id)
    },
  }
}
