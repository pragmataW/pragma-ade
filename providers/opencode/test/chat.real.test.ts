/**
 * @real-agent: drives the chat capability against the installed `opencode serve` (user's config, read only; a free
 * OpenCode model). Opt in with PRAGMA_REAL_OPENCODE=1 (optionally PRAGMA_REAL_OPENCODE_MODEL). Every session it
 * creates is deleted afterwards; the provider-connect case uses a temp XDG config/data dir.
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpenCode } from '@opencode/client'
import type { ChatEvent, ChatSessionHandle } from '@pragma/module-chat/contract'
import { afterAll, describe, expect, it } from 'vitest'
import { createOpencodeChat } from '../src/main/chat/factory'
import { passwordForServerUrl } from '../src/main/chat/server/passwords'
import { basicAuthHeader } from '../src/main/chat/server/spawn-spec'
import { connectionListSchema } from '../src/renderer/chat/connections'
import { ctxFor, fakeCapCtx, fakeProfile, ofKind, until, waitForEvent } from '../testing/fake-opencode-server/harness'

const REAL = process.env.PRAGMA_REAL_OPENCODE === '1'
const MODEL = process.env.PRAGMA_REAL_OPENCODE_MODEL ?? 'opencode/big-pickle'
const TURN_MS = 240_000
const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))
const worktree = mkdtempSync(join(tmpdir(), 'oc-real-'))
const cap = createOpencodeChat(fakeCapCtx({ getShellEnv: async () => env }), { idleGraceMs: 0 })
const created: { h: ChatSessionHandle; extra: string[] }[] = []
const report: Record<string, unknown> = {}

async function start(model = MODEL) {
  const profile = fakeProfile({ command: 'opencode' })
  const { ctx, events } = ctxFor({ profile, worktreePath: worktree, env, startupTimeoutMs: 30_000 })
  const h = await cap.createSession({ ...ctx, initialOptions: { model } })
  const entry = { h, extra: [] as string[] }
  created.push(entry)
  return { h, events, entry, profile }
}

/** A raw client on the server hosting `h` (cleanup, probes). */
async function rawClient(h: ChatSessionHandle, profile: ReturnType<typeof fakeProfile>) {
  const retained = await cap.retainServer?.({ worktreePath: worktree, profile, externalSessionId: h.externalSessionId })
  if (!retained) throw new Error('no server')
  const password = passwordForServerUrl(retained.url) ?? ''
  const client = OpenCode.make({
    baseUrl: retained.url,
    headers: { authorization: basicAuthHeader(password), 'x-opencode-directory': encodeURIComponent(worktree) },
  })
  return { client, release: retained.release }
}

const text = (events: ChatEvent[], parentId?: string) =>
  ofKind(events, 'text-delta')
    .filter((e) => e.parentId === parentId)
    .map((e) => e.text)
    .join('')

afterAll(async () => {
  for (const { h, extra } of created) {
    const profile = fakeProfile({ command: 'opencode' })
    const raw = await rawClient(h, profile).catch(() => null)
    for (const id of [h.externalSessionId, ...extra])
      await raw?.client.session.remove({ sessionID: id }).catch(() => undefined)
    await raw?.release()
    await h.close().catch(() => undefined)
  }
  await cap.dispose()
  writeFileSync(join(tmpdir(), 'oc-real-report.json'), JSON.stringify(report, null, 2))
}, TURN_MS)

describe.skipIf(!REAL)('@real-agent opencode chat', () => {
  it(
    'streams a reply; MCP status; model list only shows usable providers',
    async () => {
      const { h, events } = await start()
      await h.send({ text: 'Reply with exactly the word: pong', images: [] })
      const end = await waitForEvent(events, 'turn-end', undefined, TURN_MS)
      report.stream = { end: end.reason, text: text(events), usage: ofKind(events, 'usage').at(-1) }
      expect(end.reason).toBe('completed')
      expect(text(events).toLowerCase()).toContain('pong')
      const model = h.describeOptions().find((d) => d.key === 'model')
      report.providers = [...new Set(model?.values?.map((v) => v.description))]
      report.mcp = ofKind(events, 'mcp-status').at(-1)?.servers
    },
    TURN_MS,
  )

  it(
    'a subagent prompt yields a task with nested output; rewind and fork',
    async () => {
      const { h, events, entry } = await start()
      await h.send(
        {
          text: "Use the subagent tool exactly once to run the 'general' agent with the prompt 'Reply with the single word pong. Use no tools.' Then reply with its answer only.",
          images: [],
        },
        { messageId: 'real-msg-1' },
      )
      await waitForEvent(events, 'turn-end', undefined, TURN_MS)
      const tasks = ofKind(events, 'task')
      const last = tasks.at(-1)
      report.subagent = { statuses: tasks.map((t) => t.status), last, nested: text(events, last?.toolCallId) }
      expect(last?.status).toBe('completed')
      expect(text(events, last?.toolCallId).length).toBeGreaterThan(0)
      if (last) entry.extra.push(last.taskId)
      const before = h.externalSessionId
      await h.fork?.()
      entry.extra.push(before)
      report.fork = { from: before, to: h.externalSessionId }
      expect(h.externalSessionId).not.toBe(before)
      await h.send({ text: 'Reply with exactly: forked', images: [] }, { messageId: 'real-msg-2' })
      await until(() => ofKind(events, 'turn-end').length > 1, TURN_MS)
      await h.rewind?.('real-msg-2')
      report.rewind = ofKind(events, 'custom').at(-1)?.data
    },
    TURN_MS,
  )

  it.each(['queue', 'steer'] as const)(
    'a prompt sent while a turn runs (delivery %s): what the server does with it',
    async (delivery) => {
      const { h, events, profile } = await start()
      const raw = await rawClient(h, profile)
      await h.send({ text: 'Count slowly from 1 to 30, one number per line.', images: [] })
      await until(() => ofKind(events, 'text-delta').length > 0, TURN_MS)
      const second = await raw.client.session
        .prompt({ sessionID: h.externalSessionId, text: 'Stop counting and just say: done', delivery })
        .then((r) => ({ ok: true, id: (r as { id?: string }).id }))
        .catch((e: unknown) => ({ ok: false, error: String(e) }))
      await until(() => ofKind(events, 'turn-end').length > 0, TURN_MS)
      await new Promise((r) => setTimeout(r, 10_000))
      const messages = await raw.client.message.list({ sessionID: h.externalSessionId })
      report[`busy-${delivery}`] = {
        second,
        turnEnds: ofKind(events, 'turn-end').map((e) => e.reason),
        textTail: ofKind(events, 'text-delta')
          .filter((e) => e.mode === 'delta')
          .map((e) => e.text)
          .join('')
          .slice(-160),
        messages: (messages as { data: { type: string; text?: string }[] }).data
          .reverse()
          .map((m) => [m.type, m.text?.slice(0, 40)]),
      }
      await raw.release()
    },
    TURN_MS * 2,
  )

  it(
    'an expired key marks its provider for re-auth',
    async () => {
      const { h, events } = await start(process.env.PRAGMA_REAL_OPENCODE_BROKEN_MODEL ?? 'opencode-go/glm-5.1')
      await h.send({ text: 'hi', images: [] })
      const err = await waitForEvent(events, 'error', undefined, TURN_MS)
      await until(() => ofKind(events, 'options').length > 1, TURN_MS).catch(() => undefined)
      const flagged = h
        .describeOptions()
        .find((d) => d.key === 'model')
        ?.values?.filter((v) => v.warn)
        .map((v) => v.value)
      report.auth = {
        code: err.code,
        message: err.message,
        flaggedCount: flagged?.length,
        sample: flagged?.slice(0, 3),
      }
      expect(err.code).toBe('auth')
    },
    TURN_MS,
  )

  it(
    'provider connect in a temp OpenCode home: a fake key is saved and listed, then removed',
    async () => {
      const home = mkdtempSync(join(tmpdir(), 'oc-real-home-'))
      const tempEnv = {
        ...env,
        XDG_CONFIG_HOME: join(home, 'config'),
        XDG_DATA_HOME: join(home, 'data'),
        XDG_STATE_HOME: join(home, 'state'),
        XDG_CACHE_HOME: join(home, 'cache'),
        OPENCODE_DB: join(home, 'opencode.db'),
      }
      const temp = createOpencodeChat(fakeCapCtx({ getShellEnv: async () => tempEnv }), { idleGraceMs: 0 })
      try {
        const list = async () => connectionListSchema.parse(await temp.settingsCall?.({ op: 'list' })).providers
        const before = await list()
        await temp.settingsCall?.({ op: 'keyConnect', integrationID: 'anthropic', key: 'sk-ant-fake-key' })
        const anthropic = (await list()).find((p) => p.id === 'anthropic')
        report.connect = {
          providers: before.length,
          connectedBefore: before.filter((p) => p.credentials.length).map((p) => p.id),
          anthropic,
        }
        expect(anthropic?.credentials).toHaveLength(1)
        await temp.settingsCall?.({ op: 'remove', credentialID: anthropic?.credentials[0]?.id })
        expect((await list()).find((p) => p.id === 'anthropic')?.credentials).toEqual([])
      } finally {
        await temp.dispose()
      }
    },
    TURN_MS,
  )
})
