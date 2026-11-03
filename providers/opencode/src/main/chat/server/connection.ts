import type { AgentProfile } from '@pragma/module-agents/contract'
import { ChatStartupError } from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import { EV, IDLE_GRACE_ENV, IDLE_GRACE_MS, PROCESS_EXIT_EVENT, REASON, SSE_RECONNECT_MS } from '../constants'
import { type ProviderAccess, providerAccess } from '../mapping/model-access'
import { integrationInfoSchema, listOf, type ModelInfo, modelInfoSchema, providerInfoSchema } from '../schemas'
import { createWireClient, type WireClient } from '../wire/client'
import { EventHub } from '../wire/event-hub'
import { rememberServerPassword } from './passwords'
import { type Lease, ResourcePool } from './pool'
import { type ServerHandle, startServer } from './process'
import { buildServeSpec, type ServeSpec, serverKey } from './spawn-spec'

/** One running `serve` with its client, its SSE hub and the cached model list. */
export interface OpencodeConnection {
  readonly server: ServerHandle
  readonly client: WireClient
  readonly hub: EventHub
  readonly directory: string
  models(): Promise<ModelInfo[]>
  /** Usable model providers (cached until a provider, model or credential change). */
  access(): Promise<ProviderAccess>
  /** The provider rejected its saved credential: flagged until the credentials change. */
  markAuthFailed(providerID: string): void
  /** Models or provider access changed (refetch `models()` / `access()`). */
  onCatalogChange(cb: () => void): () => void
  stop(): Promise<void>
  onExit(cb: (code: number | null) => void): () => void
}

export interface AcquireInput {
  profile: Pick<AgentProfile, 'id' | 'command' | 'args'>
  worktreePath: string
  env: Record<string, string>
  startupTimeoutMs: number
}

export interface ConnectionPool {
  acquire(input: AcquireInput): Promise<Lease<OpencodeConnection>>
  disposeAll(): Promise<void>
  /** Test/inspection: the live server count. */
  size(): number
}

/** `PRAGMA_OPENCODE_IDLE_GRACE_MS` (tests) or the default grace. */
export function idleGraceMs(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env[IDLE_GRACE_ENV])
  return env[IDLE_GRACE_ENV] !== undefined && Number.isFinite(v) && v >= 0 ? v : IDLE_GRACE_MS
}

async function openConnection(
  spec: ServeSpec,
  o: { startupTimeoutMs: number; log: Pick<Logger, 'info' | 'warn'> },
): Promise<OpencodeConnection> {
  const server = await startServer(spec, { startTimeoutMs: o.startupTimeoutMs, log: o.log })
  const forgetPassword = rememberServerPassword(server.url, spec.password)
  server.onExit(forgetPassword)
  const client = createWireClient(server, spec.cwd)
  const hub = new EventHub(client, { reconnectMs: SSE_RECONNECT_MS, log: o.log })
  hub.start()
  const stop = async () => {
    hub.close()
    forgetPassword()
    await server.stop()
  }
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ChatStartupError(REASON.noProtocol, 'event stream')), o.startupTimeoutMs).unref(),
  )
  await Promise.race([hub.ready(), timeout]).catch(async (e: unknown) => {
    await stop()
    throw e
  })
  let models: Promise<ModelInfo[]> | null = null
  const catalog = catalogCache(client)
  hub.onGlobal((e) => {
    if (e.type === EV.modelUpdated) models = null
    catalog.changed(e.type)
  })
  return {
    server,
    client,
    hub,
    directory: spec.cwd,
    models: () => {
      models ??= client.model.list().then((r) => listOf(modelInfoSchema).parse(r).data)
      models.catch(() => {
        models = null
      })
      return models
    },
    access: catalog.access,
    markAuthFailed: catalog.markAuthFailed,
    onCatalogChange: catalog.onChange,
    stop,
    onExit: (cb) => server.onExit(cb),
  }
}

const CATALOG_EVENTS = new Set<string>([
  EV.modelUpdated,
  EV.providerUpdated,
  EV.integrationUpdated,
  EV.credentialUpdated,
])
const CREDENTIAL_EVENTS = new Set<string>([EV.integrationUpdated, EV.credentialUpdated])

/** Provider access of one server (`provider.list` + `integration.list`, null when the server has neither). */
function catalogCache(client: Pick<WireClient, 'provider' | 'integration'>) {
  const authFailed = new Set<string>()
  const cbs = new Set<() => void>()
  let access: Promise<ProviderAccess> | null = null
  const load = async (): Promise<ProviderAccess> => {
    const [providers, integrations] = await Promise.all([client.provider.list(), client.integration.list()])
    return providerAccess(
      listOf(providerInfoSchema).parse(providers).data,
      listOf(integrationInfoSchema).parse(integrations).data,
      authFailed,
    )
  }
  const invalidate = () => {
    access = null
    for (const cb of cbs) cb()
  }
  return {
    access: (): Promise<ProviderAccess> => {
      access ??= load().catch(() => null)
      return access
    },
    markAuthFailed: (providerID: string) => {
      if (authFailed.has(providerID)) return
      authFailed.add(providerID)
      invalidate()
    },
    onChange: (cb: () => void) => {
      cbs.add(cb)
      return () => void cbs.delete(cb)
    },
    changed: (type: string) => {
      if (CREDENTIAL_EVENTS.has(type)) authFailed.clear()
      if (CATALOG_EVENTS.has(type)) invalidate()
    },
  }
}

/** Servers keyed by worktree + profile + env; the `exit` safety net SIGKILLs live groups synchronously. */
export function createConnectionPool(o: {
  log: Pick<Logger, 'info' | 'warn'>
  idleGraceMs?: number
  /** 04's status plugin directory, kept out of chat servers. */
  statusPluginDir?: string
}): ConnectionPool {
  const pool = new ResourcePool<OpencodeConnection>({ idleGraceMs: o.idleGraceMs ?? idleGraceMs() })
  const live = new Set<OpencodeConnection>()
  const onProcessExit = () => {
    for (const c of live) c.server.killNow()
  }
  process.once(PROCESS_EXIT_EVENT, onProcessExit)
  return {
    async acquire(input) {
      const spec = buildServeSpec({ ...input, statusPluginDir: o.statusPluginDir })
      return pool.acquire(serverKey(spec, input.profile.id), async () => {
        const conn = await openConnection(spec, { startupTimeoutMs: input.startupTimeoutMs, log: o.log })
        live.add(conn)
        conn.onExit(() => live.delete(conn))
        return conn
      })
    },
    async disposeAll() {
      process.off(PROCESS_EXIT_EVENT, onProcessExit)
      await pool.disposeAll()
      live.clear()
    },
    size: () => live.size,
  }
}
