import type { ChatEvent } from '@pragma/module-chat/contract'
import { makeTranscript } from '@pragma/module-chat/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { PASSWORD_ENV, REASON, SERVE_ARGS } from '../src/main/chat/constants'
import { createOpencodeChat } from '../src/main/chat/factory'
import { CUSTOM } from '../src/renderer/chat/payloads'
import {
  chatSetup,
  cleanupAll,
  dropSse,
  type FakeMode,
  fakeCapCtx,
  isAlive,
  lastBody,
  ofKind,
  readLog,
  requestsOf,
  until,
  waitForEvent,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const PERMISSION_REPLY_RE = /\/permission\/[^/]+\/reply$/
const FORM_REPLY_RE = /\/form\/[^/]+\/reply$/
const FORM_RE = /\/form\/[^/]+$/
const INTERRUPT_RE = /\/interrupt$/
const textOf = (events: ChatEvent[]) =>
  makeTranscript(events)
    .items.flatMap((i) => (i.kind === 'text-delta' ? [i.text] : []))
    .join('')
const starts = (log: string) => readLog(log).flatMap((r) => (r.kind === 'start' ? [r] : []))
const formEvent = (events: ChatEvent[]) => waitForEvent(events, 'custom', (c) => c.type === CUSTOM.form)

describe('opencode chat session', () => {
  it('start emits session-info with ses_ id and commands, then options', async () => {
    const s = chatSetup()
    const h = await s.start()
    expect(h.externalSessionId).toMatch(/^ses_/)
    expect(s.events.map((e) => e.kind)).toEqual(['session-info', 'options'])
    expect(s.events[0]).toEqual({
      kind: 'session-info',
      externalSessionId: h.externalSessionId,
      commands: [
        { name: 'init', description: 'Create AGENTS.md' },
        { name: 'review', description: 'Review changes' },
      ],
    })
    expect(h.describeOptions().map((d) => d.key)).toEqual(['permissionMode', 'model', 'agent', 'effort'])
  })

  it('streams a full turn; allow_once reaches the server as once', async () => {
    const s = chatSetup()
    const h = await s.start()
    await h.send({ text: 'hi', images: [] })
    const p = await waitForEvent(s.events, 'permission-request')
    await h.respondPermission(p.requestId, 'allow_once')
    await waitForEvent(s.events, 'turn-end')
    expect(lastBody(s.h.log, PERMISSION_REPLY_RE)).toEqual({ decision: 'once' })
    expect(textOf(s.events)).toBe('Hello from fake OpenCode')
    expect(ofKind(s.events, 'turn-end')[0]?.reason).toBe('completed')
    expect(ofKind(s.events, 'permission-resolved')[0]?.outcome).toBe('allowed')
    await h.respondPermission('unknown', 'deny')
    expect(requestsOf(s.h.log, PERMISSION_REPLY_RE)).toHaveLength(1)
  })

  it('auto-approve mode answers permission requests once without asking; no server switch for the mode', async () => {
    const s = chatSetup()
    const h = await s.start()
    await h.setOption('permissionMode', 'auto')
    await h.send({ text: 'hi', images: [] })
    await waitForEvent(s.events, 'turn-end')
    expect(lastBody(s.h.log, PERMISSION_REPLY_RE)).toEqual({ decision: 'once' })
    expect(ofKind(s.events, 'permission-resolved')[0]?.outcome).toBe('allowed')
    expect(requestsOf(s.h.log, /\/session\/[^/]+\/(model|agent)$/)).toEqual([])
  })

  it('a send during a running turn goes to OpenCode’s inbox with steer delivery (no turn-end of its own)', async () => {
    const s = chatSetup({ scenario: 'long-turn' })
    const h = await s.start()
    await h.send({ text: 'first', images: [] })
    await until(() => requestsOf(s.h.log, /\/prompt$/).length === 1)
    await h.send({ text: 'second', images: [] })
    const bodies = requestsOf(s.h.log, /\/prompt$/).map((r) => r.body as { text: string; delivery?: string })
    expect(bodies.map((b) => [b.text, b.delivery])).toEqual([
      ['first', undefined],
      ['second', 'steer'],
    ])
    await h.interrupt()
  })

  it('the capability takes messages during a turn (the core sends them as mid-turn input, not a queue)', async () => {
    const cap = createOpencodeChat(fakeCapCtx(), { idleGraceMs: 0 })
    expect(cap.midTurnInput).toBe(true)
    await cap.dispose()
  })

  it('a steered message is acknowledged (message-ack) before the one shared turn-end', async () => {
    const s = chatSetup({ scenario: 'long-turn' })
    const h = await s.start()
    await h.send({ text: 'first', images: [] }, { messageId: 'm1' })
    await until(() => requestsOf(s.h.log, /\/prompt$/).length === 1)
    await h.send({ text: 'second', images: [] }, { messageId: 'm2' })
    expect(ofKind(s.events, 'message-ack')).toEqual([])
    await h.interrupt()
    await waitForEvent(s.events, 'turn-end')
    const kinds = s.events.map((e) => e.kind)
    expect(ofKind(s.events, 'message-ack').map((e) => e.messageId)).toEqual(['m2'])
    expect(kinds.indexOf('message-ack')).toBeLessThan(kinds.indexOf('turn-end'))
    expect(ofKind(s.events, 'turn-end')).toHaveLength(1)
  })

  it('profile command/args/env reach serve; PRAGMA_SESSION_ID stripped; password set', async () => {
    const env = { FOO: 'bar', PRAGMA_SESSION_ID: 'leak', PRAGMA_WORKTREE_ID: 'w1' }
    const s = chatSetup({ prefixArgs: ['--print-logs'], env, logEnv: [...Object.keys(env), 'OPENCODE_PASSWORD'] })
    await s.start()
    const [start] = starts(s.h.log)
    expect(start).toMatchObject({ argv: ['--print-logs', ...SERVE_ARGS], cwd: s.h.worktree, passwordSet: true })
    expect(start?.env).toEqual({ FOO: 'bar', PRAGMA_WORKTREE_ID: 'w1' })
    expect(PASSWORD_ENV).toBe('OPENCODE_SERVER_PASSWORD')
  })

  it('two sessions in one worktree share one serve; last close stops it', async () => {
    const a = chatSetup()
    const b = chatSetup({ home: a.h, cap: a.cap, sessionId: 'pragma-session-2' })
    const [ha, hb] = await Promise.all([a.start(), b.start()])
    expect(ha.externalSessionId).not.toBe(hb.externalSessionId)
    const [start, ...rest] = starts(a.h.log)
    expect(rest).toEqual([])
    await ha.close()
    expect(isAlive(start?.pid ?? -1)).toBe(true)
    await hb.close()
    await until(() => !isAlive(start?.pid ?? -1))
  })

  it.each([
    ['basic', PERMISSION_REPLY_RE, 'permission-resolved'],
    ['form-retry', FORM_RE, 'response-resolved'],
  ] as const)('interrupt cancels pending %s interaction before interrupting', async (scenario, route, resolved) => {
    const s = chatSetup({ scenario })
    const h = await s.start()
    await h.send({ text: 'go', images: [] })
    if (scenario === 'basic') await waitForEvent(s.events, 'permission-request')
    else await formEvent(s.events)
    await h.interrupt()
    await waitForEvent(s.events, 'turn-end')
    const paths = requestsOf(s.h.log)
      .map((r) => r.path)
      .filter((p) => route.test(p) || INTERRUPT_RE.test(p))
    expect(paths.map((p) => INTERRUPT_RE.test(p))).toEqual([false, true])
    const kinds = s.events.map((e) => e.kind)
    expect(kinds.indexOf(resolved)).toBeLessThan(kinds.indexOf('turn-end'))
    expect(ofKind(s.events, 'turn-end').map((t) => t.reason)).toEqual(['interrupted'])
    if (scenario === 'basic') expect(lastBody(s.h.log, PERMISSION_REPLY_RE)).toEqual({ decision: 'reject' })
    else expect(requestsOf(s.h.log, FORM_RE)[0]?.query).toEqual({ message: 'Interrupted by the user.' })
    expect(ofKind(s.events, 'error')).toEqual([])
  })

  it('respond answers a form; retry notice arrives first', async () => {
    const s = chatSetup({ scenario: 'form-retry' })
    const h = await s.start()
    await h.send({ text: 'go', images: [] })
    const form = await formEvent(s.events)
    expect(form).toMatchObject({ eventId: 'frm_1', awaitsResponse: true })
    expect(ofKind(s.events, 'retry')[0]).toMatchObject({ attempt: 1, reason: 'rate limited' })
    await h.respond?.('frm_1', { color: 'red', confirm: true })
    await waitForEvent(s.events, 'turn-end')
    expect(lastBody(s.h.log, FORM_REPLY_RE)).toEqual({ answer: { color: 'red', confirm: true } })
    expect(ofKind(s.events, 'response-resolved')).toEqual([
      { kind: 'response-resolved', eventId: 'frm_1', outcome: 'answered' },
    ])
    await expect(h.respond?.('frm_1', { color: 'red', confirm: true })).rejects.toThrow('invalid form answer')
  })

  it.each([[{ confirm: 'yes' }], [{ unknownKey: 1, confirm: true }], [{}], [{ color: 5, confirm: true }], ['nope']])(
    'respond rejects invalid answer %j',
    async (answer) => {
      const s = chatSetup({ scenario: 'form-retry' })
      const h = await s.start()
      await h.send({ text: 'go', images: [] })
      await formEvent(s.events)
      await expect(h.respond?.('frm_1', answer)).rejects.toThrow('invalid form answer')
      expect(requestsOf(s.h.log, FORM_REPLY_RE)).toEqual([])
    },
  )

  it('respond accepts a custom string and {cancel:true} deletes the form', async () => {
    const s = chatSetup({ scenario: 'form-retry' })
    const h = await s.start()
    await h.send({ text: 'go', images: [] })
    await formEvent(s.events)
    await h.respond?.('frm_1', { cancel: true })
    await waitForEvent(s.events, 'response-resolved')
    expect(requestsOf(s.h.log, FORM_RE).map((r) => r.method)).toEqual(['DELETE'])
    expect(ofKind(s.events, 'response-resolved')[0]?.outcome).toBe('cancelled')
    await waitForEvent(s.events, 'turn-end')
    await h.send({ text: 'again', images: [] })
    await until(() => ofKind(s.events, 'custom').filter((c) => c.type === CUSTOM.form).length === 2)
    await h.respond?.('frm_1', { color: 'teal', confirm: false })
    expect(lastBody(s.h.log, FORM_REPLY_RE)).toEqual({ answer: { color: 'teal', confirm: false } })
  })

  it('slash command goes to /command; images and @mentions become files', async () => {
    const s = chatSetup({ scenario: 'long-turn' })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${s.h.worktree}/notes.md`, '# n')
    const h = await s.start()
    await h.send({ text: '/review @notes.md', images: [] })
    await waitForEvent(s.events, 'turn-end')
    const command = requestsOf(s.h.log, /\/session\/[^/]+\/command$/)[0]?.body as {
      name: string
      text: string
      files: { uri: string }[]
    }
    expect(command).toMatchObject({ name: 'review', text: '@notes.md' })
    expect(command.files[0]?.uri).toMatch(/^file:\/\/.*notes\.md$/)
    await h.send({
      text: 'look @notes.md @nope.md',
      images: [{ name: 'a.png', mediaType: 'image/png', dataBase64: 'AA' }],
    })
    await until(() => requestsOf(s.h.log, /\/prompt$/).length === 1)
    const prompt = requestsOf(s.h.log, /\/prompt$/)[0]?.body as { files: { uri: string; mention?: unknown }[] }
    expect(prompt.files.map((f) => f.uri.slice(0, 7))).toEqual(['data:im', 'file://'])
    expect(prompt.files[1]?.mention).toEqual({ start: 5, end: 14, text: '@notes.md' })
  })

  it('setOption model/effort/agent call switch routes and emit options', async () => {
    const s = chatSetup()
    const h = await s.start()
    await h.setOption('effort', 'high')
    expect(lastBody(s.h.log, /\/model$/)).toEqual({
      model: { providerID: 'fakeprov', id: 'fake-model', variant: 'high' },
    })
    await h.setOption('model', 'fakeprov/fake-small')
    expect(lastBody(s.h.log, /\/model$/)).toEqual({ model: { providerID: 'fakeprov', id: 'fake-small' } })
    expect(h.describeOptions().map((d) => d.key)).toEqual(['permissionMode', 'model', 'agent'])
    await h.setOption('agent', 'plan')
    expect(lastBody(s.h.log, /\/agent$/)).toEqual({ agent: 'plan' })
    expect(ofKind(s.events, 'options')).toHaveLength(4)
    await expect(h.setOption('agent', 'general')).rejects.toThrow('invalid option agent')
  })

  it('initial options shape session.create', async () => {
    const s = chatSetup({ initialOptions: { agent: 'plan', model: 'fakeprov/fake-small', bogus: 1 } })
    await s.start()
    expect(lastBody(s.h.log, /\/api\/session$/)).toEqual({
      agent: 'plan',
      model: { providerID: 'fakeprov', id: 'fake-small' },
    })
  })

  it('resume loads session and applies initialOptions', async () => {
    const first = chatSetup()
    const h1 = await first.start()
    await h1.close()
    const s = chatSetup({
      home: first.h,
      cap: first.cap,
      resumeExternalSessionId: h1.externalSessionId,
      initialOptions: { agent: 'plan' },
    })
    const h = await s.start()
    expect(h.externalSessionId).toBe(h1.externalSessionId)
    expect(requestsOf(first.h.log, /\/api\/session$/)).toHaveLength(1)
    expect(lastBody(first.h.log, /\/agent$/)).toEqual({ agent: 'plan' })
    expect(h.describeOptions().find((d) => d.key === 'agent')?.current).toBe('plan')
    const missing = chatSetup({ home: first.h, cap: first.cap, resumeExternalSessionId: 'ses_missing' })
    await expect(missing.start()).rejects.toMatchObject({
      reasonKey: 'chat:resume.notFound',
      detail: expect.stringContaining('session not found: ses_missing'),
    })
  })

  it('resyncs after SSE reconnect using the idle outcome', async () => {
    const s = chatSetup({ scenario: 'long-turn', testRoutes: true })
    const h = await s.start()
    await h.send({ text: 'long', images: [] })
    await until(() => requestsOf(s.h.log, /\/prompt$/).length === 1)
    await new Promise((r) => setTimeout(r, 300))
    await dropSse(s.h.log, 2500)
    const end = await waitForEvent(s.events, 'turn-end', () => true, 8000)
    expect(end.reason).toBe('completed')
    expect(textOf(s.events)).toBe('')
    expect(requestsOf(s.h.log, /\/api\/session\/active$/).length).toBeGreaterThan(0)
  })

  it('server exit mid-turn emits fatal error, turn-end, session-exit crashed', async () => {
    const s = chatSetup({ scenario: 'long-turn', mode: 'die-after-ms:800' })
    const h = await s.start()
    await h.send({ text: 'long', images: [] })
    await waitForEvent(s.events, 'session-exit', () => true, 5000)
    const tail = s.events.slice(-3)
    expect(tail.map((e) => e.kind)).toEqual(['error', 'turn-end', 'session-exit'])
    expect(tail[0]).toMatchObject({ code: 'process_exited', message: 'opencode:chat.error.serverExited', fatal: true })
    expect(tail[1]).toMatchObject({ reason: 'error' })
    expect(tail[2]).toEqual({ kind: 'session-exit', exitCode: 1, reason: 'crashed' })
    await h.close()
    expect(ofKind(s.events, 'session-exit')).toHaveLength(1)
  })

  it('close emits session-exit closed once and keeps the OpenCode session', async () => {
    const s = chatSetup()
    const h = await s.start()
    await h.close()
    await h.close()
    expect(ofKind(s.events, 'session-exit')).toEqual([{ kind: 'session-exit', exitCode: null, reason: 'closed' }])
    expect(requestsOf(s.h.log).filter((r) => r.method === 'DELETE')).toEqual([])
  })

  it('close during a pending permission cancels it and interrupts the turn', async () => {
    const s = chatSetup()
    const h = await s.start()
    await h.send({ text: 'go', images: [] })
    await waitForEvent(s.events, 'permission-request')
    await h.close()
    expect(ofKind(s.events, 'permission-resolved')[0]?.outcome).toBe('cancelled')
    expect(lastBody(s.h.log, PERMISSION_REPLY_RE)).toEqual({ decision: 'reject' })
    expect(s.events.at(-1)).toMatchObject({ kind: 'session-exit', reason: 'closed' })
  })

  it.each<[FakeMode, string]>([
    ['legacy-1x', REASON.upgradeRequired],
    ['no-ready', REASON.noProtocol],
    ['exit-early', REASON.exitedEarly],
  ])('start with %s rejects %s', async (mode, reasonKey) => {
    const s = chatSetup({ mode, startupTimeoutMs: 1000 })
    await expect(s.start()).rejects.toMatchObject({ reasonKey })
  })

  it('dispose stops all servers', async () => {
    const a = chatSetup()
    const b = chatSetup({ cap: a.cap })
    await Promise.all([a.start(), b.start()])
    const pids = [...starts(a.h.log), ...starts(b.h.log)].map((r) => r.pid)
    expect(pids).toHaveLength(2)
    await a.cap.dispose()
    for (const pid of pids) expect(isAlive(pid)).toBe(false)
    expect(ofKind(a.events, 'session-exit')).toHaveLength(1)
  })
})
