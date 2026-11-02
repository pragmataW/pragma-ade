import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { SERVE_ARGS } from '../src/main/chat/constants'
import {
  BIN,
  call,
  cleanupFakes,
  exitCodeOf,
  FAKE_ENV,
  type FakeMode,
  newSession,
  type RunningFake,
  readLog,
  requestsOf,
  startFake,
  subscribeSse,
  until,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupFakes)

const URL_RE = /^http:\/\/127\.0\.0\.1:\d+$/

async function startTurn(f: RunningFake, text = 'hi') {
  const sse = subscribeSse(f)
  await sse.waitFor('server.connected')
  const sid = await newSession(f)
  await call(f, `/api/session/${sid}/prompt`, { body: { text } })
  return { sse, sid }
}

describe('fake opencode 2.x serve', () => {
  it('stdio ready line, basic auth, version', async () => {
    const f = await startFake()
    expect(f.url).toMatch(URL_RE)
    expect((await fetch(`${f.url}/api/info`)).status).toBe(401)
    expect((await call(f, '/api/info')).json).toMatchObject({ version: '2.2.5' })
  })

  it('exits 0 when stdin closes', async () => {
    const f = await startFake()
    f.proc.stdin.end()
    expect(await exitCodeOf(f.proc)).toBe(0)
  })

  it('logs argv prefix, env subset, password flag', async () => {
    const f = await startFake({ prefixArgs: ['--print-logs'], env: { FOO: 'bar' } })
    expect(readLog(f.log)[0]).toMatchObject({
      argv: ['--print-logs', ...SERVE_ARGS],
      env: { FOO: 'bar' },
      passwordSet: true,
    })
  })

  it.each([
    ['once', 'session.execution.succeeded'],
    ['reject', 'session.execution.failed'],
  ])('permission %s → %s', async (decision, last) => {
    const f = await startFake()
    const { sse, sid } = await startTurn(f)
    await sse.waitFor('permission.asked')
    expect((await call(f, `/api/session/${sid}/permission/per_1/reply`, { body: { decision } })).status).toBe(204)
    await sse.waitFor(last)
    expect(sse.events.find((e) => e.type === 'permission.replied')?.data).toMatchObject({ reply: decision })
    await sse.close()
  })

  it('form blocks until reply; DELETE cancels and logs message', async () => {
    const f = await startFake({ scenario: 'form-retry' })
    const { sse, sid } = await startTurn(f)
    await sse.waitFor('form.created')
    expect(sse.events.some((e) => e.type === 'session.execution.succeeded')).toBe(false)
    await call(f, `/api/session/${sid}/form/frm_1/reply`, { body: { answer: { color: 'red', confirm: true } } })
    await sse.waitFor('session.execution.succeeded')
    expect(sse.events.find((e) => e.type === 'form.replied')?.data).toMatchObject({ answer: { color: 'red' } })
    await call(f, `/api/session/${sid}/prompt`, { body: { text: 'again' } })
    await until(() => sse.events.filter((e) => e.type === 'form.created').length === 2)
    const del = await call(f, `/api/session/${sid}/form/frm_1?message=${encodeURIComponent('bye')}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(204)
    await sse.waitFor('form.cancelled')
    expect(readLog(f.log).find((r) => r.kind === 'form-cancel')).toMatchObject({ formId: 'frm_1', message: 'bye' })
    await sse.close()
  })

  it('interrupt ends running turn', async () => {
    const f = await startFake({ scenario: 'long-turn' })
    const { sse, sid } = await startTurn(f)
    await sse.waitFor('session.step.started')
    expect((await call(f, '/api/session/active')).json?.data).toHaveProperty(sid)
    expect((await call(f, `/api/session/${sid}/interrupt`, { body: {} })).json).toEqual({ interrupted: true })
    await sse.waitFor('session.execution.interrupted')
    expect(sse.events.some((e) => e.type === 'session.text.delta')).toBe(false)
    await sse.close()
  })

  it('message list returns v2 shapes and survives restart', async () => {
    const f = await startFake()
    const { sse, sid } = await startTurn(f, 'remember')
    await sse.waitFor('permission.asked')
    await call(f, `/api/session/${sid}/permission/per_1/reply`, { body: { decision: 'once' } })
    await sse.waitFor('session.execution.succeeded')
    await sse.close()
    const list = async (g: RunningFake) => (await call(g, `/api/session/${sid}/message?order=asc&limit=200`)).json
    const first = await list(f)
    expect((first as { data: { type: string }[] }).data.map((m) => m.type)).toEqual(['user', 'assistant', 'idle'])
    f.proc.stdin.end()
    await exitCodeOf(f.proc)
    const g = await startFake({ env: { [FAKE_ENV.stateDir]: f.home.stateDir } })
    expect(await list(g)).toEqual(first)
    const idle = await call(g, `/api/session/${sid}/message?order=desc&limit=1&type=idle`)
    expect(idle.json?.data).toEqual([expect.objectContaining({ type: 'idle', outcome: 'succeeded' })])
  })

  it('relative attachment uri → 400', async () => {
    const f = await startFake()
    const sid = await newSession(f)
    const res = await call(f, `/api/session/${sid}/prompt`, { body: { text: 'x', files: [{ uri: 'a.txt' }] } })
    expect(res.status).toBe(400)
  })

  it('sends the directory header through to the log', async () => {
    const f = await startFake()
    await fetch(`${f.url}/api/info`, { headers: { ...f.headers, 'x-opencode-directory': encodeURIComponent('/w ü') } })
    expect(requestsOf(f.log, /api\/info/).at(-1)?.directoryHeader).toBe('/w ü')
  })

  it.each(['no-ready', 'exit-early'] satisfies FakeMode[])('mode %s prints no ready line', async (mode) => {
    const f = await startFake({ mode, waitReady: false })
    await new Promise((r) => setTimeout(r, 300))
    expect(f.stdout()).not.toContain('url')
    if (mode === 'exit-early') expect(await exitCodeOf(f.proc)).toBe(3)
  })

  it('legacy-1x has no /api/info and reports 1.1.36 via /global/health and --version', async () => {
    const f = await startFake({ mode: 'legacy-1x', waitReady: false })
    const url = await until(() => /opencode server listening on (\S+)/.exec(f.stdout())?.[1])
    const headers = f.headers
    expect((await fetch(`${url}/api/info`, { headers })).status).toBe(404)
    expect(await (await fetch(`${url}/global/health`, { headers })).json()).toEqual({
      healthy: true,
      version: '1.1.36',
    })
    const v = spawnSync(process.execPath, [BIN, '--version'], { env: { [FAKE_ENV.mode]: 'legacy-1x' } })
    expect(v.stdout.toString().trim()).toBe('1.1.36')
  })
})
