import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type RecordingAgentBridge, startRecordingAgentBridge } from '@pragma/module-agent-status/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HOOK_BUNDLE_MAX_BYTES } from '../src/constants'

const PKG = join(import.meta.dirname, '..')
const BUNDLE = join(PKG, 'dist', 'pragma-hook.mjs')
let bridge: RecordingAgentBridge

beforeAll(async () => {
  const build = spawnSync(process.execPath, ['build.mjs'], { cwd: PKG, encoding: 'utf8' })
  if (build.status !== 0) throw new Error(build.stderr)
  bridge = await startRecordingAgentBridge()
})
afterAll(async () => bridge.server.close())

interface HookRun {
  code: number | null
  stdout: string
  stderr: string
  ms: number
}

/** Runs the bundle with `stdin` and argv; `env` defaults to the test bridge env, `null` means none. */
function runHook(stdin: string, argv: string[], opts: { env?: Record<string, string> | null; script?: string } = {}) {
  const started = Date.now()
  const bridgeEnv = bridge.env('ps1')
  const env = opts.env === undefined ? bridgeEnv : (opts.env ?? {})
  const child = spawn(process.execPath, [opts.script ?? BUNDLE, ...argv], {
    env: { PATH: process.env.PATH ?? '', ...env },
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => (stdout += d))
  child.stderr.on('data', (d) => (stderr += d))
  child.stdin.end(stdin)
  return new Promise<HookRun>((resolve) =>
    child.on('close', (code) => resolve({ code, stdout, stderr, ms: Date.now() - started })),
  )
}
const lastEvent = () => bridge.received.at(-1)?.event as Record<string, unknown>

describe('claude pragma-hook bundle', () => {
  it('posts only picked fields', async () => {
    const input = {
      hook_event_name: 'PreToolUse',
      session_id: 'cs1',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
      prompt: 'secret',
      transcript_path: '/t',
    }
    await runHook(JSON.stringify(input), ['PreToolUse'])
    expect(bridge.received.at(-1)).toMatchObject({ sessionId: 'ps1', providerId: 'claude' })
    expect(lastEvent()).toEqual({ hook_event_name: 'PreToolUse', session_id: 'cs1', tool_name: 'Bash' })
  })

  it('forwards the StopFailure error kind, never its details or the last message', async () => {
    const input = {
      hook_event_name: 'StopFailure',
      session_id: 'cs1',
      error: 'rate_limit',
      error_details: 'secret details',
      last_assistant_message: 'secret',
    }
    await runHook(JSON.stringify(input), ['StopFailure'])
    expect(lastEvent()).toEqual({ hook_event_name: 'StopFailure', session_id: 'cs1', error: 'rate_limit' })
  })

  it('argv event name when stdin lacks it', async () => {
    await runHook('{"session_id":"x"}', ['Stop'])
    expect(lastEvent()).toEqual({ hook_event_name: 'Stop', session_id: 'x' })
  })

  it('stdout and stderr are empty and exit code 0', async () => {
    const r = await runHook('{}', ['Stop'])
    expect(r).toMatchObject({ code: 0, stdout: '', stderr: '' })
  })

  it('exit 0 within 2.5 s when the bridge is down', async () => {
    const down = { PRAGMA_BRIDGE_URL: 'http://127.0.0.1:9', PRAGMA_BRIDGE_TOKEN: 't', PRAGMA_SESSION_ID: 's' }
    const r = await runHook('{}', ['Stop'], { env: down })
    expect(r.code).toBe(0)
    expect(r.ms).toBeLessThan(2500)
  })

  it('exit 0 immediately without env', async () => {
    const before = bridge.received.length
    const r = await runHook('{}', ['Stop'], { env: null })
    expect(r.code).toBe(0)
    expect(bridge.received.length).toBe(before)
  })

  it('invalid JSON stdin still posts the argv event name', async () => {
    await runHook('{not json', ['SessionEnd'])
    expect(lastEvent()).toEqual({ hook_event_name: 'SessionEnd' })
  })

  it('forwards an absolute .jsonl transcript path whole (it is watched for the interrupt marker); others not', async () => {
    const long = `/Users/u/.claude/projects/${'-deep'.repeat(60)}/cs1.jsonl`
    await runHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: long }), [])
    expect(lastEvent()).toEqual({ hook_event_name: 'UserPromptSubmit', transcript_path: long })
    for (const bad of ['relative/cs1.jsonl', '/etc/passwd', `/${'x'.repeat(4100)}.jsonl`, 42]) {
      await runHook(JSON.stringify({ hook_event_name: 'Stop', transcript_path: bad }), [])
      expect(lastEvent()).toEqual({ hook_event_name: 'Stop' })
    }
  })

  it('truncates long fields', async () => {
    await runHook(JSON.stringify({ hook_event_name: 'Stop', reason: 'r'.repeat(500) }), [])
    expect(lastEvent().reason).toBe('r'.repeat(200))
  })

  it('bundle is self-contained', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pragma-hook-alone-'))
    try {
      const copy = join(dir, 'pragma-hook.mjs')
      copyFileSync(BUNDLE, copy)
      const r = await runHook('{}', ['Notification'], { script: copy })
      expect(r).toMatchObject({ code: 0, stderr: '' })
      expect(lastEvent()).toEqual({ hook_event_name: 'Notification' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('bundle size is small', () => {
    expect(statSync(BUNDLE).size).toBeLessThan(HOOK_BUNDLE_MAX_BYTES)
  })
})
