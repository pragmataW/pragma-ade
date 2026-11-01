import { memoryLogger } from '@pragma/test-support'
import { afterEach, expect, test } from 'vitest'
import {
  type DaemonEvent,
  MSG,
  PTY_STATUS,
  type PtyInfo,
  REQ,
  type SpawnSpec,
} from '../packages/pty-daemon/src/protocol'
import { type PtyExit, PtySpawnError, TERMINAL_SETTINGS_DEFAULTS } from '../src/contract'
import type { DaemonHost } from '../src/main/daemon-host'
import { PtyServiceImpl } from '../src/main/pty-service'
import { waitFor } from './support/process'
import { output, SHELL_ENV_MARK, stopPtyServices, tempDir, testPtyService } from './support/pty-service'

afterEach(() => stopPtyServices())
const SIZE = { cols: 80, rows: 24 }

test('spawn without command runs the default shell in cwd', async () => {
  const { pty } = await testPtyService()
  const cwd = tempDir()
  const id = await pty.spawn({ cwd, ...SIZE })
  const text = output(pty, id)
  pty.write(id, 'pwd; exit\r')
  await waitFor(() => text().includes(cwd))
})

test('env merge: shellEnv < opts.env < TERM overrides', async () => {
  const { pty } = await testPtyService()
  const id = await pty.spawn({
    cwd: tempDir(),
    command: '/usr/bin/env',
    env: { X: '1', MARK: SHELL_ENV_MARK, TERM: 'dumb', ELECTRON_RUN_AS_NODE: '1' },
    ...SIZE,
  })
  const text = output(pty, id)
  await new Promise<PtyExit>((resolve) => pty.onExit(id, resolve))
  expect(text()).toContain(`MARK=${SHELL_ENV_MARK}`)
  expect(text()).toContain('X=1')
  expect(text()).toContain('TERM=xterm-256color')
  expect(text()).toContain('TERM_PROGRAM=PragmaADE')
  expect(text()).not.toContain('ELECTRON_RUN_AS_NODE')
})

test('command goes through the injected resolveCommand (ctx.env.resolveCommand)', async () => {
  const { pty } = await testPtyService({ resolveCommand: async (c) => (c === 'pr' ? '/usr/bin/printf' : null) })
  const id = await pty.spawn({ cwd: tempDir(), command: 'pr', args: ['ok'], ...SIZE })
  const text = output(pty, id)
  await waitFor(() => text().includes('ok'))
  expect(pty.get(id)?.command).toBe('/usr/bin/printf')
})

test.each([
  ['missing command', { command: 'definitely-not-a-cmd-xyz' }, 'SPAWN_FAILED'],
  ['missing binary path', { command: '/nonexistent/bin' }, 'SPAWN_FAILED'],
  ['missing cwd', { cwd: '/nonexistent/x' }, 'CWD_NOT_FOUND'],
])('%s rejects PtySpawnError %s; list() unchanged', async (_name, overrides, code) => {
  const { pty } = await testPtyService()
  const error = await pty.spawn({ cwd: tempDir(), ...SIZE, ...overrides }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(PtySpawnError)
  expect(error).toMatchObject({ code })
  expect(pty.list()).toEqual([])
})

test('spawn while the daemon is unavailable rejects UNAVAILABLE', async () => {
  const { pty, host } = await testPtyService()
  await host.shutdown()
  await expect(pty.spawn({ cwd: tempDir(), ...SIZE })).rejects.toMatchObject({ code: 'UNAVAILABLE' })
})

test('late onExit subscriber gets the stored exit', async () => {
  const { pty } = await testPtyService()
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sh', args: ['-c', 'exit 7'], ...SIZE })
  await waitFor(() => pty.get(id)?.status === 'exited')
  const exit = await new Promise<PtyExit>((resolve) => pty.onExit(id, resolve))
  expect(exit).toEqual({ ptyId: id, exitCode: 7, signal: null, reason: 'exited' })
})

test.each([
  ['SIGTERM', 15],
  ['SIGINT', 2],
  ['SIGKILL', 9],
] as const)('kill(%s) → onExit once with reason killed and the confirmed signal; get() undefined', async (sig, num) => {
  const { pty } = await testPtyService()
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sleep', args: ['30'], ...SIZE })
  const exits: PtyExit[] = []
  pty.onExit(id, (e) => exits.push(e))
  await pty.kill(id, sig)
  expect(exits).toEqual([{ ptyId: id, exitCode: null, signal: num, reason: 'killed' }])
  expect(pty.get(id)).toBeUndefined()
})

test('kill default is SIGTERM', async () => {
  const { pty } = await testPtyService()
  const script = 'trap "echo got-term; exit 4" TERM; echo armed; while :; do sleep 0.05; done'
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sh', args: ['-c', script], ...SIZE })
  const text = output(pty, id)
  await waitFor(() => text().includes('armed'))
  let exit: PtyExit | undefined
  pty.onExit(id, (e) => {
    exit = e
  })
  await pty.kill(id)
  expect(exit).toMatchObject({ exitCode: 4, reason: 'killed' })
  expect(text()).toContain('got-term')
})

test('daemon crash → reason daemon-restarted; spawn works after restart', async () => {
  const { pty, host } = await testPtyService()
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sleep', args: ['30'], ...SIZE })
  const exited = new Promise<PtyExit>((resolve) => pty.onExit(id, resolve))
  let restarted = false
  host.onRestart(() => {
    restarted = true
  })
  process.kill(host.pid as number, 'SIGKILL')
  expect(await exited).toMatchObject({ reason: 'daemon-restarted', exitCode: null })
  expect(await pty.attach(id)).toMatchObject({ found: true, exit: { reason: 'daemon-restarted' } })
  await waitFor(() => restarted)
  const next = await pty.spawn({ cwd: tempDir(), command: '/bin/echo', args: ['back'], ...SIZE })
  const text = output(pty, next)
  await waitFor(() => text().includes('back'))
})

test('paste reaches the program', async () => {
  const { pty } = await testPtyService()
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/cat', ...SIZE })
  const text = output(pty, id)
  pty.paste(id, 'hi\n')
  await waitFor(() => text().includes('hi'))
})

test('isBracketedPasteEnabled follows DECSET/DECRST 2004', async () => {
  const { pty } = await testPtyService()
  const script = "printf '\\033[?2004h'; sleep 1; printf '\\033[?2004l'; sleep 5"
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sh', args: ['-c', script], ...SIZE })
  await waitFor(() => pty.isBracketedPasteEnabled(id))
  await waitFor(() => !pty.isBracketedPasteEnabled(id), 3000)
  expect(pty.isBracketedPasteEnabled('unknown')).toBe(false)
})

test('attach on unknown id → {found:false}', async () => {
  const { pty } = await testPtyService()
  expect(await pty.attach('nope')).toEqual({ found: false })
})

test('attach returns the snapshot of a running pty', async () => {
  const { pty } = await testPtyService()
  const id = await pty.spawn({ cwd: tempDir(), command: '/bin/sh', args: ['-c', 'echo snap-me; sleep 5'], ...SIZE })
  const text = output(pty, id)
  await waitFor(() => text().includes('snap-me'))
  const res = await pty.attach(id)
  expect(res.found && res.snapshot.data).toContain('snap-me')
  expect(res.found && res.exit).toBeNull()
})

test('list filters by tags', async () => {
  const { pty } = await testPtyService()
  const sleep = { cwd: tempDir(), command: '/bin/sleep', args: ['30'], ...SIZE }
  const a = await pty.spawn({ ...sleep, tags: { owner: 'terminal', worktreeId: 'w1' } })
  await pty.spawn({ ...sleep, tags: { owner: 'agents' } })
  expect(pty.list({ tags: { owner: 'terminal' } }).map((i) => i.ptyId)).toEqual([a])
  expect(pty.list()).toHaveLength(2)
})

/** A host whose `spawn` reply and the pty's `exit` are delivered in one turn, as Node does for one IPC chunk. */
function coalescingHost(exitCode: number) {
  let emit: (e: DaemonEvent) => void = () => {}
  const host = {
    onEvent(cb: (e: DaemonEvent) => void) {
      emit = cb
      return () => {}
    },
    onCrash: () => () => {},
    request(req: { type: string; spec?: SpawnSpec }) {
      if (req.type !== REQ.spawn || !req.spec) return Promise.resolve(undefined)
      const { cwd, command, args, tags, cols, rows } = req.spec
      const info: PtyInfo = {
        ptyId: 'p1',
        pid: 1,
        cwd,
        command,
        args,
        tags,
        cols,
        rows,
        status: PTY_STATUS.running,
        exitCode: null,
        signal: null,
        createdAt: 0,
        bracketedPaste: false,
      }
      return new Promise((resolve) => {
        resolve(info)
        emit({ kind: MSG.exit, ptyId: info.ptyId, exitCode, signal: null })
      })
    },
  }
  return host as unknown as DaemonHost
}

test('an exit arriving with the spawn reply is not lost', async () => {
  const pty = new PtyServiceImpl({
    host: coalescingHost(3),
    shellEnv: async () => ({}),
    resolveCommand: async (c) => c,
    settings: () => TERMINAL_SETTINGS_DEFAULTS,
    platform: process.platform,
    exists: () => true,
    log: memoryLogger(),
  })
  const id = await pty.spawn({ cwd: tempDir(), command: '/usr/bin/true', ...SIZE })
  expect(pty.get(id)?.status).toBe('exited')
  const exit = await new Promise<PtyExit>((resolve) => pty.onExit(id, resolve))
  expect(exit).toEqual({ ptyId: id, exitCode: 3, signal: null, reason: 'exited' })
})
