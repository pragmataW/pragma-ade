import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AgentHookEventInputSchema } from '@pragma/module-agent-status/contract'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRecordMapper } from '../src/records'

const PKG = join(import.meta.dirname, '..')
const BUNDLE = join(PKG, 'dist', 'plugin', 'index.js')
const IMPORT_RE = /^\s*import[\s{*]|\bimport\(/m
const ENV = { PRAGMA_BRIDGE_URL: 'http://127.0.0.1:7', PRAGMA_BRIDGE_TOKEN: 'tok', PRAGMA_SESSION_ID: 'ps1' }

interface Plugin {
  id: string
  setup(ctx: unknown): (() => void) | undefined
}
let plugin: Plugin

beforeAll(async () => {
  const r = spawnSync(process.execPath, ['build.mjs'], { cwd: PKG, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  plugin = (await import(pathToFileURL(BUNDLE).href)).default
})

describe('createRecordMapper', () => {
  it.each<[{ type: string; data?: unknown }, unknown]>([
    [
      { type: 'session.created', data: { sessionID: 'a' } },
      { type: 'session.created', sessionID: 'a' },
    ],
    [
      { type: 'session.inbox.enqueued', data: { sessionID: 'a', item: { type: 'user' } } },
      { type: 'session.inbox.enqueued', sessionID: 'a' },
    ],
    [
      { type: 'session.execution.started', data: { sessionID: 'a' } },
      { type: 'session.execution.started', sessionID: 'a' },
    ],
    [
      { type: 'session.execution.succeeded', data: { sessionID: 'a' } },
      { type: 'session.execution.succeeded', sessionID: 'a' },
    ],
    [
      { type: 'session.execution.interrupted', data: { sessionID: 'a' } },
      { type: 'session.execution.interrupted', sessionID: 'a' },
    ],
    [
      { type: 'session.execution.failed', data: { sessionID: 'a', error: { message: 'x' } } },
      { type: 'session.execution.failed', sessionID: 'a', message: 'x' },
    ],
    [
      { type: 'session.tool.input.started', data: { sessionID: 'a', name: 'bash' } },
      { type: 'session.tool.input.started', sessionID: 'a', toolName: 'bash' },
    ],
    [
      { type: 'session.tool.success', data: { sessionID: 'a' } },
      { type: 'session.tool.success', sessionID: 'a' },
    ],
    [
      { type: 'session.tool.failed', data: { sessionID: 'a' } },
      { type: 'session.tool.failed', sessionID: 'a' },
    ],
    [
      { type: 'permission.asked', data: { sessionID: 'a', id: 'p' } },
      { type: 'permission.asked', sessionID: 'a' },
    ],
    [
      { type: 'permission.replied', data: { sessionID: 'a', requestID: 'p', reply: 'once' } },
      { type: 'permission.replied', sessionID: 'a' },
    ],
    [
      { type: 'form.created', data: { form: { sessionID: 'a' } } },
      { type: 'form.created', sessionID: 'a' },
    ],
    [
      { type: 'form.replied', data: { sessionID: 'a' } },
      { type: 'form.replied', sessionID: 'a' },
    ],
    [
      { type: 'form.cancelled', data: { sessionID: 'a' } },
      { type: 'form.cancelled', sessionID: 'a' },
    ],
    [{ type: 'session.inbox.enqueued', data: { sessionID: 'a', item: { type: 'assistant' } } }, null],
    [{ type: 'session.text.delta', data: { sessionID: 'a', delta: 'hi' } }, null],
    [{ type: 'session.status', data: {} }, null],
  ])('%j', (ev, record) => {
    expect(createRecordMapper()(ev)).toEqual(record)
  })

  it('child created not forwarded, its execution dropped, its permission forwarded with child:true', () => {
    const map = createRecordMapper()
    expect(map({ type: 'session.created', data: { sessionID: 'c', parentID: 'a' } })).toBeNull()
    expect(map({ type: 'session.execution.started', data: { sessionID: 'c' } })).toBeNull()
    expect(map({ type: 'permission.asked', data: { sessionID: 'c' } })).toEqual({
      type: 'permission.asked',
      sessionID: 'c',
      child: true,
    })
    expect(map({ type: 'form.created', data: { form: { sessionID: 'c' } } })).toMatchObject({ child: true })
  })

  it('a prompt taken back from the inbox is forwarded only when nothing runs and nothing else is queued', () => {
    const map = createRecordMapper()
    const enqueue = (inboxID: string, type = 'user') =>
      map({ type: 'session.inbox.enqueued', data: { sessionID: 'a', inboxID, item: { type } } })
    const cancel = (inboxID: string) => map({ type: 'session.inbox.cancelled', data: { sessionID: 'a', inboxID } })
    const withdrawn = { type: 'session.inbox.cancelled', sessionID: 'a' }

    enqueue('i1')
    enqueue('i2')
    expect(cancel('i1')).toBeNull()
    expect(cancel('i2')).toEqual(withdrawn)

    map({ type: 'session.execution.started', data: { sessionID: 'a' } })
    enqueue('i3')
    expect(cancel('i3')).toBeNull()
    map({ type: 'session.execution.interrupted', data: { sessionID: 'a', reason: 'user' } })

    enqueue('i4')
    map({ type: 'session.inbox.delivered', data: { sessionID: 'a', inboxID: 'i4' } })
    expect(cancel('i4')).toBeNull()
    enqueue('i5', 'compaction')
    expect(cancel('i5')).toBeNull()
    expect(cancel('unknown')).toBeNull()
  })
})

describe('built plugin bundle', () => {
  it('has exactly one export, default {id, setup}', async () => {
    const mod = await import(pathToFileURL(BUNDLE).href)
    expect(Object.keys(mod)).toEqual(['default'])
    expect(mod.default.id).toBe('pragma-status')
    expect(typeof mod.default.setup).toBe('function')
  })

  it('contains no import statements', () => {
    expect(readFileSync(BUNDLE, 'utf8')).not.toMatch(IMPORT_RE)
  })
})

describe('plugin setup', () => {
  const posts: unknown[] = []
  const saved = { ...process.env }
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    posts.length = 0
    for (const k of [...Object.keys(ENV), 'PRAGMA_STATUS_CLAIMED']) delete process.env[k]
    Object.assign(process.env, saved)
  })
  const stubFetch = (impl?: () => Promise<Response>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: { body: string }) => {
        posts.push(JSON.parse(init.body))
        return impl ? impl() : new Response(JSON.stringify({ type: 'bridge.result', payload: { accepted: true } }))
      }),
    )
  /** A fake `ctx.event.subscribe` yielding `events` once per subscription (or throwing first when `failFirst`). */
  const feed = (events: { type: string; data?: unknown }[], opts: { failFirst?: boolean } = {}) => {
    let subscriptions = 0
    const signals: AbortSignal[] = []
    const ctx = {
      event: {
        subscribe: ({ signal }: { signal: AbortSignal }) => {
          signals.push(signal)
          subscriptions++
          const fail = opts.failFirst && subscriptions === 1
          return (async function* () {
            if (fail) throw new Error('bus gone')
            yield* events
            await new Promise((r) => signal.addEventListener('abort', r))
          })()
        },
      },
    }
    return { ctx, subscriptions: () => subscriptions, signals }
  }
  const types = () => posts.map((p) => (p as { payload: { event: { type: string } } }).payload.event.type)

  it('inactive without env', () => {
    stubFetch()
    expect(plugin.setup(feed([]).ctx)).toBeUndefined()
    expect(posts).toEqual([])
  })

  it('inactive when PRAGMA_STATUS_CLAIMED already set', () => {
    stubFetch()
    Object.assign(process.env, ENV, { PRAGMA_STATUS_CLAIMED: '1' })
    expect(plugin.setup(feed([]).ctx)).toBeUndefined()
  })

  it('claims, sends pragma.ready and forwards execution.started', async () => {
    stubFetch()
    Object.assign(process.env, ENV)
    const cleanup = plugin.setup(feed([{ type: 'session.execution.started', data: { sessionID: 'oc1' } }]).ctx)
    expect(process.env.PRAGMA_STATUS_CLAIMED).toBe('1')
    await vi.waitFor(() => expect(types()).toEqual(['pragma.ready', 'session.execution.started']))
    const body = posts[1] as { type: string; payload: unknown }
    expect(body.type).toBe('agent.hookEvent')
    expect(AgentHookEventInputSchema.parse(body.payload)).toMatchObject({ sessionId: 'ps1', providerId: 'opencode' })
    cleanup?.()
  })

  it('resubscribes after the iterator throws', async () => {
    vi.useFakeTimers()
    stubFetch()
    Object.assign(process.env, ENV)
    const f = feed([{ type: 'session.execution.succeeded', data: { sessionID: 'oc1' } }], { failFirst: true })
    const cleanup = plugin.setup(f.ctx)
    await vi.advanceTimersByTimeAsync(1000)
    expect(f.subscriptions()).toBe(2)
    vi.useRealTimers()
    await vi.waitFor(() => expect(types()).toContain('session.execution.succeeded'))
    cleanup?.()
  })

  it('cleanup aborts the signal', () => {
    stubFetch()
    Object.assign(process.env, ENV)
    const f = feed([])
    plugin.setup(f.ctx)?.()
    expect(f.signals[0]?.aborted).toBe(true)
  })

  it('swallows fetch rejection', async () => {
    stubFetch(() => Promise.reject(new Error('down')))
    Object.assign(process.env, ENV)
    const cleanup = plugin.setup(feed([{ type: 'session.created', data: { sessionID: 'x' } }]).ctx)
    await vi.waitFor(() => expect(posts.length).toBe(2))
    cleanup?.()
  })
})
