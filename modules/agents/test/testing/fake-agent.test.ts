import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { FAKE_AGENT_ENV, fakeAgentStarts, readFakeAgentLog } from '../../testing'
import { spawnFakeAgent } from '../support/fakes'

let dir: string
let logFile: string
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'fake-agent-')))
  logFile = join(dir, 'log.jsonl')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const run = (args: string[], stdin: string, env: Record<string, string> = {}) =>
  spawnFakeAgent(args, { cwd: dir, stdin, env: { [FAKE_AGENT_ENV.log]: logFile, ...env } })

it('logs argv, cwd and selected env', async () => {
  const p = run(['--a', 'two words'], '/exit\n', {
    PRAGMA_SESSION_ID: 's1',
    FOO: 'bar',
    SECRET: 'x',
    [FAKE_AGENT_ENV.envKeys]: 'FOO',
  })
  await p.exited
  const [start] = fakeAgentStarts(logFile)
  expect(start?.argv).toEqual(['--a', 'two words'])
  expect(start?.cwd).toBe(realpathSync(dir))
  expect(start?.env).toMatchObject({ PRAGMA_SESSION_ID: 's1', FOO: 'bar' })
  expect(start?.env.SECRET).toBeUndefined()
})

it('records lines and exits with requested code', async () => {
  const p = run([], 'hello\n/exit 3\n')
  expect(await p.exited).toBe(3)
  const log = readFakeAgentLog(logFile)
  expect(log).toContainEqual(expect.objectContaining({ type: 'line', line: 'hello' }))
  expect(log.at(-1)).toMatchObject({ type: 'exit', code: 3 })
})

it('plugin command runs', async () => {
  const p = run([], '/ping\n/exit\n', {
    [FAKE_AGENT_ENV.plugins]: join(import.meta.dirname, 'fixtures', 'ping-plugin.mjs'),
  })
  await p.exited
  expect(readFakeAgentLog(logFile).some((e) => e.type === 'pong')).toBe(true)
  expect(p.stdout()).toContain('pong')
})

it('stdout shows prompt', async () => {
  const p = run(['-x'], '/exit\n')
  await p.exited
  expect(p.stdout()).toContain('fake-agent ready\r\nargs: ["-x"]\r\n> ')
})

it('--version prints FAKE_AGENT_VERSION', async () => {
  const p = run(['--version'], '', { [FAKE_AGENT_ENV.version]: '1.1.36' })
  expect(await p.exited).toBe(0)
  expect(p.stdout()).toBe('1.1.36\n')
  expect(readFakeAgentLog(logFile)).toEqual([])
})
