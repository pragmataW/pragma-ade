import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type ConnectionPool, createConnectionPool, idleGraceMs } from '../src/main/chat/server/connection'
import type { HubEvent } from '../src/main/chat/wire/event-hub'
import {
  cleanupFakes,
  fakeServeInput,
  readLog,
  requestsOf,
  silentLog,
  tempOpencodeHome,
  until,
} from '../testing/fake-opencode-server/harness'

const pools: ConnectionPool[] = []
afterEach(async () => {
  await Promise.all(pools.splice(0).map((p) => p.disposeAll()))
  cleanupFakes()
})

const newPool = (grace = 0) => {
  const p = createConnectionPool({ log: silentLog, idleGraceMs: grace })
  pools.push(p)
  return p
}
const starts = (log: string) => readLog(log).filter((r) => r.kind === 'start')

const CHAT_SRC = join(import.meta.dirname, '..', 'src', 'main', 'chat')
const EXPERIMENTAL_RE = /\.experimental\b/
function grepChatSources(re: RegExp): string[] {
  const files = readdirSync(CHAT_SRC, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts'))
    .map((d) => join(d.parentPath, d.name))
  return files.filter((f) => re.test(readFileSync(f, 'utf8')))
}

describe('opencode wire', () => {
  it('client authenticates and sends directory header', async () => {
    const h = tempOpencodeHome()
    const lease = await newPool().acquire(fakeServeInput(h))
    const models = await lease.resource.models()
    expect(models.map((m) => m.id)).toEqual(['fake-model', 'fake-small'])
    expect(requestsOf(h.log, /\/api\/model$/).at(-1)?.directoryHeader).toBe(h.worktree)
    expect((await lease.resource.client.server.info()).version).toBe('2.2.5')
    lease.release()
  })

  it('hub fans out by sessionID and resubscribes after drop-sse', async () => {
    const h = tempOpencodeHome()
    const lease = await newPool().acquire(fakeServeInput(h, { testRoutes: true, scenario: 'long-turn' }))
    const { client, hub, server } = lease.resource
    const [a, b] = await Promise.all([client.session.create({}), client.session.create({})])
    const got = { a: [] as HubEvent[], b: [] as HubEvent[] }
    hub.subscribe(a.id, (e) => got.a.push(e))
    hub.subscribe(b.id, (e) => got.b.push(e))
    let reconnects = 0
    hub.onReconnect(() => {
      reconnects += 1
    })
    await client.session.prompt({ sessionID: a.id, text: 'hi' })
    await until(() => got.a.some((e) => e.type === 'session.execution.succeeded'))
    expect(got.b).toEqual([])
    await fetch(`${server.url}/__test/drop-sse`, { method: 'POST', headers: { authorization: server.authHeader } })
    await until(() => reconnects === 1)
    await client.session.prompt({ sessionID: b.id, text: 'again' })
    await until(() => got.b.some((e) => e.type === 'session.execution.succeeded'))
    lease.release()
  })

  it('acquire shares one server per worktree+profile, different worktrees differ', async () => {
    const pool = newPool()
    const h = tempOpencodeHome()
    const [x, y] = await Promise.all([pool.acquire(fakeServeInput(h)), pool.acquire(fakeServeInput(h))])
    expect(x.resource).toBe(y.resource)
    expect(starts(h.log)).toHaveLength(1)
    const other = tempOpencodeHome()
    const z = await pool.acquire(fakeServeInput(other))
    expect(z.resource.server.pid).not.toBe(x.resource.server.pid)
    expect(pool.size()).toBe(2)
    for (const l of [x, y, z]) l.release()
    await until(() => pool.size() === 0)
  })

  it('idle grace comes from the env override', () => {
    expect(idleGraceMs({ PRAGMA_OPENCODE_IDLE_GRACE_MS: '0' })).toBe(0)
    expect(idleGraceMs({ PRAGMA_OPENCODE_IDLE_GRACE_MS: 'nope' })).toBe(2000)
    expect(idleGraceMs({})).toBe(2000)
  })

  it('chat sources never call experimental namespaces', () => {
    expect(grepChatSources(EXPERIMENTAL_RE)).toEqual([])
  })
})
