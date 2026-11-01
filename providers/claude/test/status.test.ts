import { spawn, spawnSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AgentHookEventInput, agentBridge, type StatusLaunchContext } from '@pragma/module-agent-status/contract'
import { fakeCapabilityContext, makeLaunchContext } from '@pragma/module-agents/testing'
import { startTestBridgeServer } from '@pragma/module-bridge/testing'
import type { CapabilityRegistration } from '@pragma/sdk'
import { afterEach, describe, expect, it } from 'vitest'
import { CLAUDE_STATUS_HOOK_EVENTS } from '../src/main/status/constants'
import { parseClaudeHookEvent } from '../src/main/status/parse-event'
import statusRegistration, { createClaudeStatusCapability } from '../src/main/status.capability'

const POSIX = process.platform !== 'win32'
const HOOKS_PKG = join(import.meta.dirname, '..', 'packages', 'hooks')
const cleanups: string[] = []
afterEach(async () => {
  for (const d of cleanups.splice(0)) await rm(d, { recursive: true, force: true })
})
const tempDirNamed = async (name = 'session') => {
  const root = await mkdtemp(join(tmpdir(), 'pragma-claude-status-'))
  cleanups.push(root)
  const dir = join(root, name)
  await mkdir(dir, { mode: 0o700 })
  return dir
}

/** A launch context with a real temp dir and a `writeTempFile` that writes 0600 files like 03 does. */
async function makeLaunchCtx(over: Partial<StatusLaunchContext> = {}, dirName?: string): Promise<StatusLaunchContext> {
  const tempDir = await tempDirNamed(dirName)
  return {
    ...makeLaunchContext({ tempDir }),
    bridgeUrl: 'http://127.0.0.1:1',
    bridgeToken: 't',
    async writeTempFile(name, contents) {
      const path = join(tempDir, name)
      await writeFile(path, contents, { mode: 0o600 })
      return path
    },
    ...over,
  }
}
const spec = (args: string[] = []) => ({ command: 'claude', args, env: {}, cwd: '/w' })
const capability = (hookScriptPath = '/res/hooks/pragma-hook.mjs') =>
  createClaudeStatusCapability({ hookScriptPath, execPath: process.execPath, platform: process.platform, chmod })

describe('parseClaudeHookEvent', () => {
  const s = { session_id: 'c1' }
  it.each<[Record<string, unknown> | unknown, Record<string, unknown> | null]>([
    [
      { hook_event_name: 'SessionStart', ...s },
      { kind: 'sessionStarted', externalSessionId: 'c1' },
    ],
    [{ hook_event_name: 'UserPromptSubmit', ...s }, { kind: 'promptSubmitted' }],
    [
      { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', ...s },
      { kind: 'waitingForUser', reason: 'question' },
    ],
    [
      { hook_event_name: 'PreToolUse', tool_name: 'ExitPlanMode', ...s },
      { kind: 'waitingForUser', reason: 'input' },
    ],
    [
      { hook_event_name: 'PreToolUse', tool_name: 'Bash', ...s },
      { kind: 'toolStarted', toolName: 'Bash' },
    ],
    [{ hook_event_name: 'PostToolUse', ...s }, { kind: 'toolFinished' }],
    [{ hook_event_name: 'PostToolUseFailure', ...s }, { kind: 'toolFinished' }],
    [
      { hook_event_name: 'PermissionRequest', ...s },
      { kind: 'waitingForUser', reason: 'permission' },
    ],
    [
      { hook_event_name: 'Notification', notification_type: 'permission_prompt', ...s },
      { kind: 'waitingForUser', reason: 'permission' },
    ],
    [
      { hook_event_name: 'Notification', notification_type: 'elicitation_dialog', ...s },
      { kind: 'waitingForUser', reason: 'question' },
    ],
    [{ hook_event_name: 'Notification', notification_type: 'idle_prompt', ...s }, null],
    [{ hook_event_name: 'Notification', ...s }, null],
    [
      { hook_event_name: 'Stop', ...s },
      { kind: 'turnCompleted', externalSessionId: 'c1' },
    ],
    [{ hook_event_name: 'StopFailure', ...s }, { kind: 'turnFailed' }],
    [{ hook_event_name: 'SessionEnd', ...s }, { kind: 'sessionEnded' }],
    [{ hook_event_name: 'Other', ...s }, null],
    ['Stop', null],
    [null, null],
  ])('%j → %j', (raw, expected) => {
    const result = parseClaudeHookEvent(raw)
    if (expected === null) expect(result).toBeNull()
    else expect(result).toMatchObject(expected)
  })

  it('missing session_id → no externalSessionId', () => {
    expect(parseClaudeHookEvent({ hook_event_name: 'Stop' })).toEqual({ kind: 'turnCompleted' })
  })
})

describe('claude status capability', () => {
  it('prepends --settings and keeps user args', async () => {
    const ctx = await makeLaunchCtx()
    const out = await capability().decorateLaunch(spec(['--dangerously-skip-permissions', 'hi']), ctx)
    expect(out.args).toEqual([
      '--settings',
      join(ctx.tempDir, 'claude-settings.json'),
      '--dangerously-skip-permissions',
      'hi',
    ])
  })

  it('keeps a user --settings flag after ours', async () => {
    const out = await capability().decorateLaunch(spec(['--settings', '/user.json']), await makeLaunchCtx())
    expect(out.args.slice(2)).toEqual(['--settings', '/user.json'])
  })

  it('settings JSON has only hooks with exactly CLAUDE_STATUS_HOOK_EVENTS', async () => {
    const ctx = await makeLaunchCtx()
    const out = await capability().decorateLaunch(spec(), ctx)
    const settings = JSON.parse(await readFile(out.args[1] as string, 'utf8'))
    expect(Object.keys(settings)).toEqual(['hooks'])
    expect(Object.keys(settings.hooks)).toEqual([...CLAUDE_STATUS_HOOK_EVENTS])
    expect(settings.hooks.Stop[0].hooks[0]).toMatchObject({ type: 'command', timeout: 5 })
  })

  it.runIf(POSIX)('runner is 0700 and inside tempDir; settings 0600', async () => {
    const ctx = await makeLaunchCtx()
    const out = await capability().decorateLaunch(spec(), ctx)
    expect(await readdir(ctx.tempDir)).toEqual(['claude-settings.json', 'pragma-hook.sh'])
    expect((await stat(join(ctx.tempDir, 'pragma-hook.sh'))).mode & 0o777).toBe(0o700)
    expect((await stat(out.args[1] as string)).mode & 0o777).toBe(0o600)
  })

  it('never writes under HOME', async () => {
    const home = await tempDirNamed('home')
    const before = process.env.HOME
    process.env.HOME = home
    try {
      await capability().decorateLaunch(spec(), await makeLaunchCtx())
    } finally {
      process.env.HOME = before
    }
    expect(await readdir(home)).toEqual([])
  })

  it('factory resolves the hook path via capCtx.paths.resource (one argument)', () => {
    const calls: unknown[][] = []
    const capCtx = fakeCapabilityContext({
      paths: {
        data: '/d',
        temp: '/t',
        resource: (...args: unknown[]) => {
          calls.push(args)
          return `/res/${args[0]}`
        },
      },
    })
    ;(statusRegistration as CapabilityRegistration).create(capCtx)
    expect(calls).toEqual([['hooks/pragma-hook.mjs']])
  })
})

describe.runIf(POSIX)('claude runner (posix)', () => {
  const build = () => {
    const r = spawnSync(process.execPath, ['build.mjs'], { cwd: HOOKS_PKG, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(r.stderr)
    return join(HOOKS_PKG, 'dist', 'pragma-hook.mjs')
  }

  it.each(['session', "a b'c"])('runner runs the built hook (tempDir %j)', async (dirName) => {
    const server = await startTestBridgeServer()
    const received: AgentHookEventInput[] = []
    server.registerHandler(agentBridge, {
      hookEvent: (input) => {
        received.push(input)
        return { accepted: true }
      },
    })
    try {
      const ctx = await makeLaunchCtx({}, dirName)
      await capability(build()).decorateLaunch(spec(), ctx)
      const env = {
        PATH: process.env.PATH ?? '',
        PRAGMA_BRIDGE_URL: server.url,
        PRAGMA_BRIDGE_TOKEN: server.token,
        PRAGMA_SESSION_ID: 's9',
      }
      const child = spawn(join(ctx.tempDir, 'pragma-hook.sh'), ['Stop'], { env })
      child.stdin.end('{}')
      expect(await new Promise((resolve) => child.on('close', resolve))).toBe(0)
      expect(received).toEqual([{ sessionId: 's9', providerId: 'claude', event: { hook_event_name: 'Stop' } }])
    } finally {
      await server.close()
    }
  })
})
