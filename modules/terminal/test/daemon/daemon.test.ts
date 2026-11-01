import { afterEach, beforeAll, expect, test } from 'vitest'
import { PtyDaemon } from '../../packages/pty-daemon/src/daemon'
import { PROTOCOL_VERSION, type PtyInfo } from '../../packages/pty-daemon/src/protocol'
import { ensureSpawnHelperExecutable } from '../../packages/pty-daemon/src/spawn-helper'
import { shSpec, spec } from '../support/factories'
import { memoryTransport } from '../support/memory-transport'
import { isAlive, waitFor } from '../support/process'

beforeAll(() => ensureSpawnHelperExecutable())
const daemons: PtyDaemon[] = []
afterEach(async () => {
  await Promise.all(daemons.splice(0).map((d) => d.shutdown()))
})

function startDaemon() {
  const link = memoryTransport()
  const exits: number[] = []
  const daemon = new PtyDaemon(link.transport, { exit: (code) => exits.push(code) })
  daemons.push(daemon)
  daemon.start()
  return { link, exits, daemon }
}

const resultOf = <T>(r: { ok: boolean; result?: unknown }): T => {
  expect(r.ok).toBe(true)
  return r.result as T
}

test('ready → spawn → data → exit', async () => {
  const { link } = startDaemon()
  expect(link.received[0]).toEqual({ kind: 'ready', pid: process.pid, protocolVersion: PROTOCOL_VERSION })
  const info = resultOf<PtyInfo>(await link.request({ type: 'spawn', spec: shSpec('printf hi; exit 2') }))
  expect(info.status).toBe('running')
  const exit = await waitFor(() => link.events().find((e) => e.kind === 'exit'))
  expect(exit).toMatchObject({ ptyId: info.ptyId, exitCode: 2 })
  expect(link.events().some((e) => e.kind === 'data' && e.data.includes('hi'))).toBe(true)
})

test.each([
  ['missing cwd', { cwd: '/nonexistent/x' }, 'CWD_NOT_FOUND'],
  ['missing binary', { command: '/nonexistent/bin' }, 'SPAWN_FAILED'],
])('spawn with %s fails with %s and leaves no session', async (_name, overrides, code) => {
  const { link } = startDaemon()
  const res = await link.request({ type: 'spawn', spec: spec(overrides) })
  expect(res).toMatchObject({ ok: false, error: { code } })
  expect(resultOf(await link.request({ type: 'list' }))).toEqual([])
})

test.each([
  { type: 'write', ptyId: 'nope', data: 'x' },
  { type: 'resize', ptyId: 'nope', cols: 80, rows: 24 },
  { type: 'snapshot', ptyId: 'nope' },
  { type: 'readText', ptyId: 'nope' },
  { type: 'kill', ptyId: 'nope' },
] as const)('$type on unknown pty → NOT_FOUND', async (req) => {
  const { link } = startDaemon()
  expect(await link.request(req)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})

test('garbage message → BAD_REQUEST, daemon keeps working', async () => {
  const { link } = startDaemon()
  link.sendRaw({ id: 99, type: 'nope' })
  link.sendRaw('garbage')
  await waitFor(() => link.responseTo(99))
  expect(link.responseTo(99)).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } })
  expect(link.responseTo(-1)).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } })
  expect(resultOf(await link.request({ type: 'list' }))).toEqual([])
})

test('kill forgets the session', async () => {
  const { link } = startDaemon()
  const info = resultOf<PtyInfo>(await link.request({ type: 'spawn', spec: shSpec('exec sleep 30') }))
  const killed = resultOf<PtyInfo>(await link.request({ type: 'kill', ptyId: info.ptyId }))
  expect(killed).toMatchObject({ status: 'exited', signal: 15 })
  expect(link.events().some((e) => e.kind === 'exit' && e.ptyId === info.ptyId)).toBe(true)
  expect(resultOf(await link.request({ type: 'list' }))).toEqual([])
})

test('transport close kills all sessions and exits(0)', async () => {
  const { link, exits } = startDaemon()
  const a = resultOf<PtyInfo>(await link.request({ type: 'spawn', spec: shSpec('exec sleep 30') }))
  const b = resultOf<PtyInfo>(await link.request({ type: 'spawn', spec: shSpec('exec sleep 30') }))
  link.close()
  await waitFor(() => exits.length > 0, 3000)
  expect(exits).toEqual([0])
  await waitFor(() => !isAlive(a.pid) && !isAlive(b.pid), 3000)
})
