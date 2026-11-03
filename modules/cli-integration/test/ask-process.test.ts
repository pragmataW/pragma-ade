import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AskSpec } from '../src/contract'
import { runAskProcess } from '../src/main/ask/process'
import { FAKE_ASK_ENV, type FakeAskRecord, writeFakeAskBin } from '../testing'

const posix = process.platform !== 'win32'
let dir: string
let bin: string

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'ask-proc-')))
  bin = await writeFakeAskBin(dir)
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const spec = (env: Record<string, string> = {}, over: Partial<AskSpec> = {}): AskSpec => ({
  command: bin,
  args: [],
  env: { PATH: process.env.PATH ?? '', HOME: dir, ...env },
  stdin: null,
  ...over,
})
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const waitFor = async (ok: () => boolean, ms = 3000) => {
  const end = Date.now() + ms
  while (!ok() && Date.now() < end) await new Promise((r) => setTimeout(r, 25))
  return ok()
}

describe.skipIf(!posix)('runAskProcess', () => {
  it('round-trips argv, stdin, stdout, stderr, exit code and cwd', async () => {
    const record = join(dir, 'record.json')
    const env = {
      [FAKE_ASK_ENV.record]: record,
      [FAKE_ASK_ENV.stdout]: 'answer',
      [FAKE_ASK_ENV.stderr]: 'warn',
      [FAKE_ASK_ENV.exit]: '3',
    }
    const out = await runAskProcess(spec(env, { args: ['-p', 'x y'], stdin: 'the question' }), {
      cwd: dir,
      timeoutMs: 5000,
    })
    expect(out).toEqual({ kind: 'exited', exitCode: 3, stdout: 'answer', stderr: 'warn' })
    const r = JSON.parse(await readFile(record, 'utf8')) as FakeAskRecord
    expect(r.argv).toEqual(['-p', 'x y'])
    expect(r.stdin).toBe('the question')
    expect(r.cwd).toBe(dir)
    expect(r.env.HOME).toBe(dir)
  })

  it('closes stdin when there is none to write', async () => {
    const out = await runAskProcess(spec({ [FAKE_ASK_ENV.stdout]: 'ok' }), { cwd: dir, timeoutMs: 5000 })
    expect(out).toMatchObject({ kind: 'exited', exitCode: 0, stdout: 'ok' })
  })

  it('times out and kills the whole process tree', async () => {
    const pidFile = join(dir, 'child.pid')
    const env = { [FAKE_ASK_ENV.sleepMs]: '30000', [FAKE_ASK_ENV.childPidFile]: pidFile }
    const out = await runAskProcess(spec(env), { cwd: dir, timeoutMs: 800, killGraceMs: 500 })
    expect(out).toEqual({ kind: 'timedOut' })
    const pid = Number(await readFile(pidFile, 'utf8'))
    expect(await waitFor(() => !alive(pid))).toBe(true)
  })

  it('is aborted by the signal', async () => {
    const ac = new AbortController()
    const p = runAskProcess(spec({ [FAKE_ASK_ENV.sleepMs]: '30000' }), {
      cwd: dir,
      timeoutMs: 10_000,
      signal: ac.signal,
    })
    setTimeout(() => ac.abort(), 200)
    expect(await p).toEqual({ kind: 'aborted' })
  })

  it('an already aborted signal never spawns', async () => {
    const record = join(dir, 'never.json')
    const out = await runAskProcess(spec({ [FAKE_ASK_ENV.record]: record }), {
      cwd: dir,
      timeoutMs: 5000,
      signal: AbortSignal.abort(),
    })
    expect(out).toEqual({ kind: 'aborted' })
    await expect(readFile(record)).rejects.toThrow()
  })

  it('too much stdout kills the child', async () => {
    const out = await runAskProcess(spec({ [FAKE_ASK_ENV.stdout]: 'x'.repeat(5000) }), {
      cwd: dir,
      timeoutMs: 5000,
      maxStdoutBytes: 100,
    })
    expect(out).toEqual({ kind: 'tooLarge' })
  })

  it('keeps only the tail of stderr', async () => {
    const out = await runAskProcess(spec({ [FAKE_ASK_ENV.stderr]: `${'a'.repeat(50)}TAIL` }), {
      cwd: dir,
      timeoutMs: 5000,
      maxStderrBytes: 10,
    })
    expect(out).toMatchObject({ kind: 'exited', stderr: 'aaaaaaTAIL' })
  })

  it('a missing binary is a spawn failure', async () => {
    const out = await runAskProcess(spec({}, { command: join(dir, 'missing') }), { cwd: dir, timeoutMs: 5000 })
    expect(out.kind).toBe('spawnFailed')
  })

  it('rejects an invalid spec', async () => {
    await expect(runAskProcess(spec({}, { command: '' }), { cwd: dir, timeoutMs: 5000 })).rejects.toThrow()
  })
})
