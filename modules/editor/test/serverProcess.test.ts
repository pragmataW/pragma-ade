import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { startArgs } from '../src/main/server/args'
import { runOnce, type ServerEvent, ServerProcess } from '../src/main/server/serverProcess'
import { choosePort, writeConnectionToken } from '../src/main/server/serverState'
import { fakeLogPath, fakeServerCommand, isAlive, readFakeLog } from './support/fakeServer'
import { tempDir } from './support/httpFixture'
import { until } from './support/wait'

const tmp = tempDir()
let n = 0
const live: ServerProcess[] = []
afterEach(async () => {
  for (const s of live.splice(0)) await s.stop(1000)
})
afterAll(() => tmp.cleanup())

async function make(
  env: Record<string, string> = {},
  over: Partial<ConstructorParameters<typeof ServerProcess>[0]> = {},
) {
  const dir = join(tmp.dir, `s-${++n}`)
  mkdirSync(dir)
  const { port } = await choosePort(join(dir, 'state.json'))
  const tokenFile = join(dir, 'token')
  await writeConnectionToken(tokenFile)
  const dirs = { serverDataDir: join(dir, 'server'), userDataDir: join(dir, 'data'), extensionsDir: join(dir, 'ext') }
  const log = fakeLogPath(dir, 'fake')
  const lines: string[] = []
  const proc = new ServerProcess({
    ...fakeServerCommand(),
    args: startArgs({ port, tokenFile, dirs, graceSeconds: 10 }),
    env: { ...process.env, FAKE_REH_LOG: log, PRAGMA_BRIDGE_URL: 'ws://127.0.0.1:9/x', ...env },
    port,
    readyTimeoutMs: 5000,
    backoffMs: [20, 40, 80],
    log: (l) => lines.push(l),
    ...over,
  })
  const events: ServerEvent[] = []
  proc.on((e) => events.push(e))
  live.push(proc)
  return { proc, events, log, lines, dir, port }
}

const onceMarker = (): string => join(tmp.dir, `once-${++n}`)

describe('ServerProcess', () => {
  it('start resolves after /version is up and emits ready; stdout token is redacted', async () => {
    const { proc, events, port, lines } = await make()
    await proc.start()
    expect(events).toEqual([{ type: 'ready', port }])
    await until(() => lines.some((l) => l.includes('Web UI available')))
    expect(lines.find((l) => l.includes('Web UI'))).toContain('tkn=<redacted>')
  })

  it('env is passed through (FAKE_REH_LOG shows PRAGMA_BRIDGE_URL)', async () => {
    const { proc, log } = await make()
    await proc.start()
    expect(readFakeLog(log)[0]?.env?.PRAGMA_BRIDGE_URL).toBe('ws://127.0.0.1:9/x')
  })

  it('crash triggers restart with backoff then ready', async () => {
    const { proc, events } = await make({ FAKE_REH_CRASH_AFTER_MS: '300', FAKE_REH_ONCE_MARKER: onceMarker() })
    await proc.start()
    await until(() => events.filter((e) => e.type === 'ready').length === 2)
    expect(events.map((e) => e.type)).toEqual(['ready', 'restarting', 'ready'])
  })

  it('more than maxCrashes in window → failed serverCrashed', async () => {
    const { proc, events } = await make({ FAKE_REH_CRASH_AFTER_MS: '700' }, { maxCrashes: 2 })
    await proc.start()
    await until(() => events.some((e) => e.type === 'failed'), 15_000)
    expect(events.at(-1)).toMatchObject({ type: 'failed', errorKey: 'editor:errors.serverCrashed' })
    expect(events.filter((e) => e.type === 'restarting')).toHaveLength(2)
  })

  it('hung /version → health restart', async () => {
    const { proc, events } = await make(
      { FAKE_REH_HANG_AFTER_MS: '300', FAKE_REH_ONCE_MARKER: onceMarker() },
      { healthIntervalMs: 150, healthFailures: 2 },
    )
    await proc.start()
    await until(() => events.filter((e) => e.type === 'ready').length === 2, 20_000)
    expect(events.map((e) => e.type)).toContain('restarting')
  }, 30_000)

  it('start times out → failed serverStartFailed', async () => {
    const { proc, events } = await make({ FAKE_REH_HANG_VERSION: '1' }, { readyTimeoutMs: 800 })
    await expect(proc.start()).rejects.toThrow()
    expect(events.at(-1)).toMatchObject({ type: 'failed', errorKey: 'editor:errors.serverStartFailed' })
  }, 15_000)

  it('stop kills the whole process group', async () => {
    const { proc, log, events } = await make({ FAKE_REH_SPAWN_CHILD: '1' })
    await proc.start()
    await until(() => readFakeLog(log).some((e) => e.type === 'child'))
    const childPid = readFakeLog(log).find((e) => e.type === 'child')?.childPid as number
    const pid = proc.pid as number
    expect(isAlive(childPid)).toBe(true)
    await proc.stop()
    await until(() => !isAlive(childPid) && !isAlive(pid))
    expect(events.at(-1)).toEqual({ type: 'stopped' })
  })

  it('stop is not counted as crash', async () => {
    const { proc, events } = await make()
    await proc.start()
    await proc.stop()
    await new Promise((r) => setTimeout(r, 200))
    expect(events.map((e) => e.type)).toEqual(['ready', 'stopped'])
  })

  it('runOnce returns exit code and output', async () => {
    const r = await runOnce(
      fakeServerCommand(),
      ['--install-extension', join(tmp.dir, 'missing.vsix')],
      process.env,
      5000,
    )
    expect(r.code).not.toBe(0)
    const ok = await runOnce(
      { command: process.execPath, argsPrefix: ['-e'], shell: false },
      ['console.log("hi")'],
      process.env,
      5000,
    )
    expect(ok).toMatchObject({ code: 0, stdout: 'hi\n' })
  })
})
