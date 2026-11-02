import { type ChatStartupError, isChatStartupError } from '@pragma/module-chat/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { PASSWORD_ENV, REASON, SERVE_ARGS } from '../src/main/chat/constants'
import { classifyStartFailure, type StartFailure, startServer } from '../src/main/chat/server/process'
import { parseReadyLine, parseVersion } from '../src/main/chat/server/ready'
import { buildServeSpec, type ServeSpec, serverKey, withoutStatusPlugin } from '../src/main/chat/server/spawn-spec'
import {
  cleanupFakes,
  type FakeMode,
  fakeEnv,
  fakeProfile,
  isAlive,
  readLog,
  tempOpencodeHome,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupFakes)

const silent = { info: () => undefined, warn: () => undefined }
const specInput = {
  profile: { command: 'opencode', args: ['--print-logs'] },
  worktreePath: '/w',
  env: { PATH: '/bin', PRAGMA_SESSION_ID: 's1', OPENCODE_PASSWORD: 'x', PRAGMA_WORKTREE_ID: 'w1' },
  password: 'pw',
}
const base = buildServeSpec(specInput)
const keyCases: [string, ServeSpec, ServeSpec, boolean][] = [
  ['same input, other password', base, { ...base, password: 'other', env: { ...base.env, [PASSWORD_ENV]: 'o' } }, true],
  ['env order', base, { ...base, env: Object.fromEntries(Object.entries(base.env).reverse()) }, true],
  ['other worktree', base, { ...base, cwd: '/v' }, false],
  ['other args', base, { ...base, args: ['x', ...base.args] }, false],
  ['other env', base, { ...base, env: { ...base.env, FOO: '1' } }, false],
]

/** Starts the fake through `startServer`; the error (if any) and the logged pids. */
async function startWith(mode: FakeMode, o: { stopGraceMs?: number; startTimeoutMs?: number } = {}) {
  const h = tempOpencodeHome()
  const spec = buildServeSpec({
    profile: fakeProfile(),
    worktreePath: h.worktree,
    env: { PATH: process.env.PATH ?? '', ...fakeEnv(h, { mode }) },
  })
  const result = await startServer(spec, { startTimeoutMs: o.startTimeoutMs ?? 5000, log: silent, ...o }).then(
    (server) => ({ server, error: null }),
    (error: unknown) => ({ server: null, error }),
  )
  const pids = readLog(h.log).flatMap((r) => (r.kind === 'start' ? [r.pid] : []))
  return { ...result, pids, h }
}

describe('serve spawn spec', () => {
  it('spec prefixes profile args, strips session env and alt password', () => {
    expect(base).toEqual({
      command: 'opencode',
      args: ['--print-logs', ...SERVE_ARGS],
      env: { PATH: '/bin', PRAGMA_WORKTREE_ID: 'w1', [PASSWORD_ENV]: 'pw' },
      cwd: '/w',
      password: 'pw',
    })
  })

  it.each([
    ['only the plugin → variable dropped', { plugins: ['/res/hooks/plugin'] }, undefined],
    [
      'other plugins and keys kept',
      { plugins: ['/mine', '/res/hooks/plugin'], model: 'x' },
      { plugins: ['/mine'], model: 'x' },
    ],
    ['no status plugin → unchanged', { plugins: ['/mine'] }, { plugins: ['/mine'] }],
  ])('status plugin stripped: %s', (_, config, expected) => {
    const env = { PATH: '/bin', OPENCODE_CONFIG_CONTENT: JSON.stringify(config) }
    const out = withoutStatusPlugin(env, '/res/hooks/plugin')
    expect(out.OPENCODE_CONFIG_CONTENT === undefined ? undefined : JSON.parse(out.OPENCODE_CONFIG_CONTENT)).toEqual(
      expected,
    )
    expect(
      buildServeSpec({ ...specInput, env, statusPluginDir: '/res/hooks/plugin' }).env.OPENCODE_CONFIG_CONTENT,
    ).toBe(out.OPENCODE_CONFIG_CONTENT)
  })

  it('invalid config content is left alone', () => {
    const env = { OPENCODE_CONFIG_CONTENT: 'not json' }
    expect(withoutStatusPlugin(env, '/res/hooks/plugin')).toBe(env)
  })

  it('empty command → emptyCommand', () => {
    expect(() => buildServeSpec({ ...specInput, profile: { command: ' ', args: [] } })).toThrow(REASON.emptyCommand)
  })

  it('generates a password when none is given', () => {
    const { password, env } = buildServeSpec({ ...specInput, password: undefined })
    expect(password.length).toBeGreaterThan(20)
    expect(env[PASSWORD_ENV]).toBe(password)
  })

  it.each(keyCases)('server key: %s', (_, a, b, same) => expect(serverKey(a, 'p') === serverKey(b, 'p')).toBe(same))
})

describe('ready line and version', () => {
  it.each([
    ['{"url":"http://127.0.0.1:4100"}', { url: 'http://127.0.0.1:4100', format: 'stdio' }],
    [
      'server listening on http://127.0.0.1:4096\nserver password abc',
      { url: 'http://127.0.0.1:4096', format: 'listening' },
    ],
    ['opencode server listening on http://127.0.0.1:4096', { url: 'http://127.0.0.1:4096', format: 'legacy' }],
    ['booting…', null],
  ])('ready line %j', (line, expected) => expect(parseReadyLine(line)).toEqual(expected))

  it.each([
    ['opencode v2.2.5', 2],
    ['v2.2.5', 2],
    ['1.1.36', 1],
    ['nope', undefined],
  ])('version %s', (text, major) => expect(parseVersion(text)?.major).toBe(major))

  it.each<[StartFailure, string, string | undefined]>([
    [{ kind: 'legacy' }, REASON.upgradeRequired, '1.x'],
    [{ kind: 'legacy', healthVersion: '1.1.36' }, REASON.upgradeRequired, '1.1.36'],
    [{ kind: 'old', version: '1.9.0' }, REASON.upgradeRequired, '1.9.0'],
    [{ kind: 'info-error', message: 'HTTP 500' }, REASON.infoFailed, 'HTTP 500'],
    [{ kind: 'spawn-error', code: 'ENOENT', command: 'oc', message: 'm' }, REASON.commandNotFound, 'oc'],
    [{ kind: 'spawn-error', code: 'EACCES', command: 'oc', message: 'denied' }, REASON.exitedEarly, 'denied'],
    [{ kind: 'exited', code: 3, stderrLine: 'boom' }, REASON.exitedEarly, 'exit 3: boom'],
    [{ kind: 'timeout', tail: 'out' }, REASON.noProtocol, 'out'],
  ])('classifyStartFailure %j', (failure, reasonKey, detail) => {
    expect(classifyStartFailure(failure)).toMatchObject({ reasonKey, detail })
  })
})

describe('serve process', () => {
  it('starts the fake via stdio and reports version/pid', async () => {
    const { server, pids } = await startWith('normal')
    expect(server?.version).toBe('2.2.5')
    expect(server?.pid).toBe(pids[0])
    expect(server?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('stdin close stops the server', async () => {
    const { server } = await startWith('normal', { stopGraceMs: 10_000 })
    const started = Date.now()
    await server?.stop()
    expect(server?.exited).toBe(true)
    expect(server?.exitCode).toBe(0)
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it.each<[FakeMode, string]>([
    ['exit-early', REASON.exitedEarly],
    ['no-ready', REASON.noProtocol],
    ['legacy-1x', REASON.upgradeRequired],
    ['version:1.9.0', REASON.upgradeRequired],
  ])('mode %s → %s, no live pid', async (mode, reasonKey) => {
    const { error, pids } = await startWith(mode, { startTimeoutMs: 1000, stopGraceMs: 300 })
    expect(isChatStartupError(error) && error.reasonKey).toBe(reasonKey)
    expect(pids.length).toBe(1)
    for (const pid of pids) expect(isAlive(pid)).toBe(false)
  })

  it('exit-early detail carries the exit code and stderr', async () => {
    const { error } = await startWith('exit-early')
    expect((error as ChatStartupError).detail).toBe('exit 3: boom')
  })

  it('legacy detail carries 1.1.36', async () => {
    const { error } = await startWith('legacy-1x', { stopGraceMs: 300 })
    expect((error as ChatStartupError).detail).toBe('1.1.36')
  })

  it('version 3.0.0 accepted', async () => {
    const { server } = await startWith('version:3.0.0')
    expect(server?.version).toBe('3.0.0')
  })

  it('missing binary → commandNotFound', async () => {
    const h = tempOpencodeHome()
    const spec = buildServeSpec({
      profile: { command: '/nonexistent/opencode-xyz', args: [] },
      worktreePath: h.worktree,
      env: {},
    })
    const error = await startServer(spec, { startTimeoutMs: 1000, log: silent }).catch((e: unknown) => e)
    expect(error).toMatchObject({ reasonKey: REASON.commandNotFound, detail: '/nonexistent/opencode-xyz' })
  })

  it('escalates to SIGKILL when lease and SIGTERM ignored', async () => {
    const { server, pids } = await startWith('ignore-lease', { stopGraceMs: 200 })
    expect(server).not.toBeNull()
    await server?.stop()
    expect(isAlive(pids[0] ?? -1)).toBe(false)
  })

  it('onExit fires when the server dies on its own', async () => {
    const { server } = await startWith('die-after-ms:300')
    const code = await new Promise((r) => server?.onExit(r))
    expect(code).toBe(1)
    expect(server?.exited).toBe(true)
  })

  it('killNow ends the process synchronously', async () => {
    const { server, pids } = await startWith('ignore-lease')
    server?.killNow()
    await new Promise((r) => server?.onExit(r))
    expect(isAlive(pids[0] ?? -1)).toBe(false)
  })
})
