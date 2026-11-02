import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StatusLaunchContext } from '@pragma/module-agent-status/contract'
import { fakeCapabilityContext, makeLaunchContext } from '@pragma/module-agents/testing'
import type { CapabilityRegistration } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import { mergeOpencodeConfigContent } from '../src/main/status/config-content'
import { parseOpencodeEvent } from '../src/main/status/parse-event'
import { withStandalone } from '../src/main/status/standalone'
import statusRegistration, { createOpencodeStatusCapability } from '../src/main/status.capability'

const PLUGIN_DIR = '/res/hooks/plugin'
const makeLaunchCtx = (over: Partial<StatusLaunchContext> = {}) => ({
  ...makeLaunchContext(),
  bridgeUrl: 'http://127.0.0.1:1',
  bridgeToken: 't',
  ...over,
})
const spec = (args: string[] = [], env: Record<string, string> = {}) => ({ command: 'opencode', args, env, cwd: '/w' })
const capability = () => createOpencodeStatusCapability({ pluginDir: PLUGIN_DIR })
const configOf = (env: Record<string, string>) => JSON.parse(env.OPENCODE_CONFIG_CONTENT as string)

describe('parseOpencodeEvent', () => {
  const s = { sessionID: 'oc1' }
  it.each<[unknown, Record<string, unknown> | null]>([
    [{ type: 'pragma.ready' }, { kind: 'sessionStarted' }],
    [
      { type: 'session.created', ...s },
      { kind: 'sessionStarted', externalSessionId: 'oc1' },
    ],
    [{ type: 'session.inbox.enqueued', ...s }, { kind: 'promptSubmitted' }],
    [{ type: 'session.execution.started', ...s }, { kind: 'promptSubmitted' }],
    [
      { type: 'session.tool.input.started', toolName: 'bash', ...s },
      { kind: 'toolStarted', toolName: 'bash' },
    ],
    [{ type: 'session.tool.success', ...s }, { kind: 'toolFinished' }],
    [{ type: 'session.tool.failed', ...s }, { kind: 'toolFinished' }],
    [
      { type: 'session.execution.succeeded', ...s },
      { kind: 'turnCompleted', externalSessionId: 'oc1' },
    ],
    [{ type: 'session.execution.interrupted', ...s }, { kind: 'turnInterrupted' }],
    [{ type: 'session.inbox.cancelled', ...s }, { kind: 'turnInterrupted' }],
    [
      { type: 'session.execution.failed', message: 'no model', ...s },
      { kind: 'turnFailed', message: 'no model' },
    ],
    [
      { type: 'permission.asked', ...s },
      { kind: 'waitingForUser', reason: 'permission' },
    ],
    [
      { type: 'form.created', ...s },
      { kind: 'waitingForUser', reason: 'question' },
    ],
    [{ type: 'permission.replied', ...s }, { kind: 'userResponded' }],
    [{ type: 'form.replied', ...s }, { kind: 'userResponded' }],
    [{ type: 'form.cancelled', ...s }, { kind: 'userResponded' }],
    [{ type: 'session.status', ...s }, null],
    [{ type: 'constructor' }, null],
    ['x', null],
    [null, null],
  ])('%j → %j', (raw, expected) => {
    const result = parseOpencodeEvent(raw)
    if (expected === null) expect(result).toBeNull()
    else expect(result).toMatchObject(expected)
  })

  it('child has no externalSessionId', () => {
    expect(parseOpencodeEvent({ type: 'permission.asked', sessionID: 'c', child: true })).toEqual({
      kind: 'waitingForUser',
      reason: 'permission',
    })
  })
})

describe('mergeOpencodeConfigContent', () => {
  it.each<[string | undefined, Record<string, unknown>]>([
    [undefined, { plugins: [PLUGIN_DIR] }],
    ['{not json', { plugins: [PLUGIN_DIR] }],
    ['[1]', { plugins: [PLUGIN_DIR] }],
    ['{"model":"x","plugin":["legacy"]}', { model: 'x', plugin: ['legacy'], plugins: [PLUGIN_DIR] }],
    ['{"plugins":["/a"]}', { plugins: ['/a', PLUGIN_DIR] }],
    [`{"plugins":["${PLUGIN_DIR}"]}`, { plugins: [PLUGIN_DIR] }],
    ['{"plugins":"bad"}', { plugins: [PLUGIN_DIR] }],
  ])('%s', (existing, expected) => {
    expect(JSON.parse(mergeOpencodeConfigContent(existing, PLUGIN_DIR))).toEqual(expected)
  })
})

describe('withStandalone', () => {
  it.each<[string[], string[], boolean]>([
    [[], ['--standalone'], true],
    [['--model', 'x'], ['--model', 'x', '--standalone'], true],
    [['--standalone', '--model', 'x'], ['--standalone', '--model', 'x'], true],
    [['--server', 'http://h:1'], ['--server', 'http://h:1'], false],
    [['--server=http://h:1'], ['--server=http://h:1'], false],
  ])('%j → %j', (args, out, injectable) => {
    expect(withStandalone(args)).toEqual({ args: out, injectable })
  })
})

describe('opencode status capability', () => {
  it('adds the plugin dir and --standalone', async () => {
    const out = await capability().decorateLaunch(spec(['--standalone']), makeLaunchCtx())
    expect(out.args).toEqual(['--standalone'])
    expect(configOf(out.env)).toEqual({ plugins: [PLUGIN_DIR] })
  })

  it('--server in args → spec unchanged', async () => {
    const input = spec(['--server', 'http://h:1'])
    expect(await capability().decorateLaunch(input, makeLaunchCtx())).toBe(input)
  })

  it.each<[string, Record<string, string>, Partial<StatusLaunchContext>]>([
    ['spec.env', { OPENCODE_CONFIG_CONTENT: '{"plugins":["/spec"]}' }, {}],
    ['ctx.env', {}, { env: { OPENCODE_CONFIG_CONTENT: '{"plugins":["/spec"]}' } }],
    ['ctx.shellEnv', {}, { shellEnv: { OPENCODE_CONFIG_CONTENT: '{"plugins":["/spec"]}' } }],
  ])('existing config from %s', async (_n, env, over) => {
    const out = await capability().decorateLaunch(spec([], env), makeLaunchCtx(over))
    expect(configOf(out.env).plugins).toEqual(['/spec', PLUGIN_DIR])
  })

  it('never writes under HOME or XDG dirs', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pragma-oc-home-'))
    const saved = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME }
    Object.assign(process.env, { HOME: home, XDG_CONFIG_HOME: join(home, '.config') })
    try {
      const ctx = makeLaunchCtx()
      await capability().decorateLaunch(spec(), ctx)
      expect(ctx.written).toEqual([])
      expect(await readdir(home)).toEqual([])
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      await rm(home, { recursive: true, force: true })
    }
  })

  it('pluginDir from capCtx.paths.resource', async () => {
    const calls: string[] = []
    const capCtx = fakeCapabilityContext({
      paths: {
        data: '/d',
        temp: '/t',
        resource: (rel) => {
          calls.push(rel)
          return `/R/${rel}`
        },
      },
    })
    const cap = (statusRegistration as CapabilityRegistration).create(capCtx) as ReturnType<
      typeof createOpencodeStatusCapability
    >
    expect(calls).toEqual(['hooks/plugin'])
    const out = await cap.decorateLaunch(spec(), makeLaunchCtx())
    expect(configOf(out.env).plugins).toEqual(['/R/hooks/plugin'])
  })
})
