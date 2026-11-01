import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FAKE_INIT,
  FAKE_PERMISSION_ID,
  FAKE_PLAIN_OUTPUT,
  FAKE_TEXT,
  readScenarioFile,
  SCENARIOS,
  type ScenarioName,
  scenarioJson,
} from '../../testing/fake-claude-stream/scenario'
import { initRequest, lastReport, runFake, userFrame } from './support'

const SESSION = '0f0e0d0c-0b0a-4908-8706-050403020100'
const isType = (type: string) => (f: Record<string, unknown>) => f.type === type
const responseTo = (id: string) => (f: Record<string, unknown>) =>
  f.type === 'control_response' && (f.response as { request_id?: string }).request_id === id

describe('fake-claude', () => {
  it.each(Object.keys(SCENARIOS) as ScenarioName[])('scenarios/%s.json matches its builder', (name) => {
    expect(JSON.parse(readScenarioFile(name))).toEqual(JSON.parse(scenarioJson(name)))
  })

  it('answers initialize with scenario commands/models', async () => {
    const { fake } = runFake('basic', {})
    fake.send(initRequest())
    const reply = (await fake.waitFor(responseTo('init-1'))) as { response: { response: Record<string, unknown> } }
    expect(reply.response.response).toMatchObject({ commands: FAKE_INIT?.commands, models: FAKE_INIT?.models })
  })

  it('records argv, cwd and PROFILE_* env', async () => {
    const { fake, home } = runFake('basic', { args: ['--x', 'y', '--session-id', SESSION], env: { PROFILE_MARK: '1' } })
    fake.send(initRequest())
    await fake.waitFor(responseTo('init-1'))
    expect(lastReport(home.report)).toMatchObject({
      argv: ['--x', 'y', '--session-id', SESSION],
      cwd: home.worktree,
      sessionId: SESSION,
      env: { PROFILE_MARK: '1', CLAUDE_CONFIG_DIR: home.configDir, HOME: home.home },
    })
  })

  it('basic turn streams deltas, assistant, result after a user frame', async () => {
    const { fake } = runFake('basic', {})
    fake.send(userFrame('hi'))
    await fake.waitFor(isType('result'))
    const types = fake.frames().map((f) => f.type)
    expect(types[0]).toBe('system')
    const deltas = fake
      .frames()
      .filter((f) => (f.event as { type?: string } | undefined)?.type === 'content_block_delta')
      .map((f) => (f.event as { delta: { text: string } }).delta.text)
    expect(deltas.length).toBeGreaterThan(1)
    expect(deltas.join('')).toBe(FAKE_TEXT.basic)
    expect(types.indexOf('assistant')).toBeLessThan(types.indexOf('result'))
  })

  it('requestPermission blocks until the matching control_response', async () => {
    const { fake } = runFake('tool-edit-permission', {})
    fake.send(userFrame('edit'))
    await fake.waitFor((f) => f.type === 'control_request')
    await new Promise((r) => setTimeout(r, 150))
    expect(fake.frames().some(isType('result'))).toBe(false)
    fake.send({
      type: 'control_response',
      response: { subtype: 'success', request_id: FAKE_PERMISSION_ID, response: { behavior: 'allow' } },
    })
    await fake.waitFor(isType('result'))
  })

  it('writes a resumable transcript with an intact parentUuid chain', async () => {
    const first = runFake('basic', { args: ['--session-id', SESSION] })
    first.fake.send(userFrame('one'))
    await first.fake.waitFor(isType('result'))
    first.fake.child.stdin.end()
    await first.fake.exited
    const env = { CLAUDE_CONFIG_DIR: first.home.configDir }
    const second = runFake('basic', { args: ['--resume', SESSION], env, cwd: first.home.worktree })
    second.fake.send(userFrame('two'))
    await second.fake.waitFor(isType('result'))
    const projects = join(first.home.configDir, 'projects')
    const [dir] = readdirSync(projects)
    const lines = readFileSync(join(projects, dir as string, `${SESSION}.jsonl`), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { uuid: string; parentUuid: string | null; type: string })
    expect(lines.filter((l) => l.type === 'user')).toHaveLength(2)
    for (const [i, line] of lines.entries()) expect(line.parentUuid).toBe(i === 0 ? null : lines[i - 1]?.uuid)
  })

  it('not-stream-json prints plain text and never answers initialize', async () => {
    const { fake } = runFake('not-stream-json', {})
    fake.send(initRequest())
    await new Promise((r) => setTimeout(r, 300))
    expect(fake.stdout()).toBe(FAKE_PLAIN_OUTPUT)
    expect(fake.frames()).toEqual([])
  })
})
