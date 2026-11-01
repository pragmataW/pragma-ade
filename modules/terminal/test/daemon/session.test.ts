import { afterEach, beforeAll, expect, test } from 'vitest'
import { PASTE_START } from '../../packages/pty-daemon/src/constants'
import { PtySession } from '../../packages/pty-daemon/src/session'
import { ensureSpawnHelperExecutable } from '../../packages/pty-daemon/src/spawn-helper'
import { fakePty, shSpec, spec } from '../support/factories'
import { waitFor } from '../support/process'
import { eventLog, restore } from '../support/session'

beforeAll(() => ensureSpawnHelperExecutable())
const sessions: PtySession[] = []
afterEach(() => {
  for (const s of sessions.splice(0)) s.dispose()
})

function start(script: string) {
  const log = eventLog()
  const session = new PtySession('p1', shSpec(script), log.emit)
  sessions.push(session)
  return { log, session }
}

function startFake(platform: NodeJS.Platform = 'darwin') {
  const log = eventLog()
  const pty = fakePty()
  const session = new PtySession('f1', spec(), log.emit, () => pty, platform)
  sessions.push(session)
  return { log, pty, session }
}

test('emits output and exit code', async () => {
  const { log, session } = start('printf hello; exit 3')
  const exit = await log.exit()
  expect(log.text()).toContain('hello')
  expect(log.events.at(-1)).toEqual(exit)
  expect(exit).toMatchObject({ kind: 'exit', exitCode: 3, signal: null })
  expect(session.info.status).toBe('exited')
})

test('seq increases by one per data event', async () => {
  const { log } = start('for i in 1 2 3 4 5; do printf "$i"; sleep 0.02; done')
  await log.exit()
  const seqs = log.of('data').map((e) => e.seq)
  expect(seqs.length).toBeGreaterThan(1)
  expect(seqs).toEqual(seqs.map((_, i) => i + 1))
})

test('snapshot round-trips colors, CJK and emoji into a fresh headless terminal', async () => {
  const { log, session } = start("printf '\\033[31mred\\033[0m 漢字 🎉\\r\\nline2'; sleep 5")
  await waitFor(() => log.text().includes('line2'))
  const term = await restore(await session.snapshot())
  const line = (i: number) => term.buffer.active.getLine(i)?.translateToString(true)
  expect([line(0), line(1)]).toEqual(['red 漢字 🎉', 'line2'])
  const cell = term.buffer.active.getLine(0)?.getCell(0)
  expect(cell?.isFgPalette()).toBeTruthy()
  expect(cell?.getFgColor()).toBe(1)
})

test('snapshot seq equals last emitted seq', async () => {
  const { log, session } = start('printf one; sleep 0.05; printf two; sleep 5')
  await waitFor(() => log.text().includes('two'))
  const snap = await session.snapshot()
  expect(snap.seq).toBe(log.of('data').at(-1)?.seq)
  expect(snap.data).toContain('two')
})

test('alternate screen survives snapshot', async () => {
  const { log, session } = start("printf '\\033[?1049hALT'; sleep 5")
  await waitFor(() => log.text().includes('ALT'))
  const term = await restore(await session.snapshot())
  expect(term.buffer.active.type).toBe('alternate')
})

test('coalesces flood output', async () => {
  const { log } = start('seq 1 20000')
  await log.exit()
  expect(log.text()).toContain('20000')
  expect(log.of('data').length).toBeLessThan(400)
})

test('kill escalates to SIGKILL for a process ignoring SIGTERM', async () => {
  const { session } = start("trap '' TERM; sleep 30")
  await new Promise((r) => setTimeout(r, 100))
  const t0 = Date.now()
  const info = await session.kill()
  expect(Date.now() - t0).toBeLessThan(4500)
  expect(info.signal).toBe(9)
}, 10_000)

test.each([
  ['SIGTERM', 15],
  ['SIGINT', 2],
  ['SIGKILL', 9],
  ['SIGHUP', 1],
] as const)('kill(%s) reports the confirmed exit signal %d', async (signal, number) => {
  const { session } = start('exec sleep 30')
  await new Promise((r) => setTimeout(r, 100))
  const info = await session.kill(signal)
  expect(info).toMatchObject({ status: 'exited', signal: number, exitCode: null })
})

test('win32: kill() calls pty.kill() without a signal', async () => {
  const { pty, session } = startFake('win32')
  const done = session.kill('SIGTERM')
  expect(pty.kills).toEqual([undefined])
  pty.emitExit({ exitCode: 1 })
  expect((await done).exitCode).toBe(1)
})

test('paste is bracketed only after the program enables mode 2004', async () => {
  const on = startFake()
  on.pty.emitData('\x1b[?2004h')
  await waitFor(() => on.session.info.bracketedPaste)
  on.session.paste('x')
  expect(on.pty.writes.at(-1)).toContain(PASTE_START)
  const off = startFake()
  off.session.paste('x')
  expect(off.pty.writes.at(-1)).not.toContain(PASTE_START)
})

test.each([
  [['\x1b[?2004h'], [true]],
  [
    ['\x1b[?2004h', '\x1b[?2004l'],
    [true, false],
  ],
  [['plain text'], []],
])('mode 2004 tracking for %j emits modes events %j and updates info.bracketedPaste', async (chunks, expected) => {
  const { log, pty, session } = startFake()
  for (const chunk of chunks) {
    pty.emitData(chunk)
    await session.snapshot() // separate flushes
  }
  expect(log.of('modes').map((e) => e.bracketedPaste)).toEqual(expected)
  expect(session.info.bracketedPaste).toBe(expected.at(-1) ?? false)
})

test('readText returns the visible lines without trailing blanks', async () => {
  const { log, session } = start("printf 'a\\r\\nb'; sleep 5")
  await waitFor(() => log.text().includes('b'))
  expect(await session.readText()).toBe('a\nb')
})
