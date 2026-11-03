import { afterEach, describe, expect, it } from 'vitest'
import { loadOpencodeHistory } from '../src/main/chat/history-loader'
import { historyToEvents } from '../src/main/chat/mapping/history'
import { type Message, messageSchema } from '../src/main/chat/schemas'
import {
  cleanupAll,
  fakeContextEnv,
  fakeProfile,
  kinds,
  newTestPool,
  ofKind,
  requestsOf,
  seedState,
  tempOpencodeHome,
  until,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const tokens = { input: 1200, output: 300, reasoning: 0, cache: { read: 500, write: 0 } }
const patch = '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b\n'
const tool = (id: string, name: string, state: Record<string, unknown>) => ({ type: 'tool', id, name, state })
const done = (input: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  status: 'completed',
  input,
  content: [{ type: 'text', text: 'ok' }],
  ...extra,
})

const fakeMessages: Message[] = [
  {
    id: 'u1',
    type: 'user',
    text: 'hi',
    files: [{ mime: 'image/png', name: 'shot.png', data: '' }, { mime: 'text/plain' }],
  },
  {
    id: 'a1',
    type: 'assistant',
    model: { id: 'fake-model', providerID: 'fakeprov' },
    content: [
      { type: 'reasoning', text: 'Thinking about it' },
      { type: 'text', text: 'Hello from fake OpenCode' },
      tool('call_read', 'read', done({ path: 'README.md' })),
      tool(
        'call_edit',
        'edit',
        done({ path: 'src/a.ts' }, { metadata: { files: [{ file: 'src/a.ts', patch, status: 'modified' }] } }),
      ),
      tool('call_todo', 'todo', done({}, { metadata: { todos: [{ content: 'Ship', status: 'in_progress' }] } })),
    ],
    tokens,
    cost: 0.0123,
  },
  { id: 'i1', type: 'idle', outcome: 'succeeded' },
].map((m) => messageSchema.parse(m))

const win = () => 10_000

describe('history replay', () => {
  it('replays user, assistant content, tools with edits and todos, usage, idle outcome', () => {
    const out = historyToEvents(fakeMessages, win)
    expect(kinds(out)).toEqual([
      'message',
      'thinking',
      'text-delta',
      'tool-call',
      'tool-result',
      'tool-call',
      'tool-result',
      'file-edit',
      'tool-call',
      'tool-result',
      'todo',
      'usage',
      'turn-end',
    ])
    expect(ofKind(out, 'message')[0]).toMatchObject({
      origin: 'history',
      attachments: [{ kind: 'image', name: 'shot.png', mediaType: 'image/png' }],
    })
    expect(ofKind(out, 'usage')[0]).toMatchObject({ contextTokens: 2000, contextWindow: 10000, costUsd: 0.0123 })
    expect(ofKind(out, 'tool-call')[0]).toMatchObject({ title: 'README.md', status: 'running' })
  })

  it.each([
    ['succeeded', 'completed'],
    ['failed', 'error'],
    ['interrupted', 'interrupted'],
  ] as const)('idle %s → turn-end %s', (outcome, reason) => {
    expect(historyToEvents([messageSchema.parse({ id: 'i', type: 'idle', outcome })], win)).toEqual([
      { kind: 'turn-end', reason },
    ])
  })

  it('usage is cumulative and an assistant error becomes an error row', () => {
    const a = (id: string, extra: Record<string, unknown> = {}) =>
      messageSchema.parse({ id, type: 'assistant', content: [], tokens, cost: 1, ...extra })
    const out = historyToEvents([a('a1'), a('a2', { error: { type: 'X', message: 'bad' } })], win)
    expect(ofKind(out, 'usage').map((u) => [u.inputTokens, u.costUsd])).toEqual([
      [1200, 1],
      [2400, 2],
    ])
    expect(ofKind(out, 'error')[0]).toMatchObject({ code: 'turn_failed', message: 'bad', fatal: false })
  })

  it('loader paginates via cursor and releases the lease', async () => {
    const h = tempOpencodeHome()
    const sid = 'ses_seed'
    const many = Array.from({ length: 250 }, (_, i) =>
      i % 2 === 0 ? { id: `u${i}`, type: 'user', text: `m${i}` } : { id: `i${i}`, type: 'idle', outcome: 'succeeded' },
    )
    seedState(h, sid, many)
    const pool = newTestPool()
    const load = loadOpencodeHistory(pool, async () => fakeContextEnv(h))
    const events = await load({ profile: fakeProfile(), worktreePath: h.worktree, env: {}, externalSessionId: sid })
    expect(events[0]).toEqual({ kind: 'session-info', externalSessionId: sid })
    expect(ofKind(events, 'message')).toHaveLength(125)
    expect(ofKind(events, 'turn-end')).toHaveLength(125)
    const pages = requestsOf(h.log, /\/message$/)
    expect(pages.map((r) => [r.query.cursor, r.query.order])).toEqual([
      [undefined, 'asc'],
      ['asc:200', undefined],
    ])
    await until(() => pool.size() === 0)
  })

  it('loader replays a live fake turn the same way', async () => {
    const h = tempOpencodeHome()
    const pool = newTestPool()
    const env = fakeContextEnv(h, { scenario: 'long-turn' })
    const lease = await pool.acquire({ profile: fakeProfile(), worktreePath: h.worktree, env, startupTimeoutMs: 5000 })
    const { client, hub } = lease.resource
    const session = await client.session.create({})
    let finished = false
    hub.subscribe(session.id, (e) => {
      if (e.type === 'session.execution.succeeded') finished = true
    })
    await client.session.prompt({ sessionID: session.id, text: 'hello' })
    await until(() => finished)
    lease.release()
    const load = loadOpencodeHistory(pool, async () => env)
    const events = await load({ profile: fakeProfile(), worktreePath: h.worktree, env, externalSessionId: session.id })
    expect(kinds(events)).toEqual(['session-info', 'message', 'text-delta', 'turn-end'])
  })
})
