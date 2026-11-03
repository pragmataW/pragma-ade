import { askWithFakeBinary } from '@pragma/module-cli-integration/testing'
import { describe, expect, it } from 'vitest'
import { createAskCapability } from '../src/main/ask.capability'

const ok = (result: string) =>
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result, session_id: 's' })
const READ_ONLY = [
  '-p',
  '--output-format',
  'json',
  '--no-session-persistence',
  '--permission-mode',
  'plan',
  '--disallowedTools',
  'Edit,Write,NotebookEdit',
]

describe.skipIf(process.platform === 'win32')('claude ask capability', () => {
  it('runs claude -p read-only with the prompt on stdin', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: ok('4'), prompt: 'What is 2+2?' })
    expect(r.record.argv).toEqual(READ_ONLY)
    expect(r.record.stdin).toBe('What is 2+2?')
    expect(r.answer).toEqual({ ok: true, text: '4' })
  })

  it('uses the profile command and forwards only --model from the profile args', async () => {
    const profile = { command: 'my-claude', args: ['--dangerously-skip-permissions', '--model', 'opus'] }
    const r = await askWithFakeBinary(createAskCapability, { stdout: ok('x'), profile })
    expect(r.resolved).toEqual(['my-claude'])
    expect(r.record.argv).toEqual([...READ_ONLY, '--model', 'opus'])
    expect(r.record.argv).not.toContain('--dangerously-skip-permissions')
  })

  it('drops a parent Claude session from the env and keeps the profile env', async () => {
    const r = await askWithFakeBinary(createAskCapability, {
      stdout: ok('x'),
      shellEnv: { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'parent', KEEP: 'yes' },
      profile: { env: { ANTHROPIC_MODEL: 'm' } },
    })
    expect(r.record.env.CLAUDECODE).toBeUndefined()
    expect(r.record.env.CLAUDE_CODE_SESSION_ID).toBeUndefined()
    expect(r.record.env.KEEP).toBe('yes')
    expect(r.record.env.ANTHROPIC_MODEL).toBe('m')
  })

  it('takes the last JSON line', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: `warming up\n${ok('final')}\n\n` })
    expect(r.answer).toEqual({ ok: true, text: 'final' })
  })

  it('an error result is a failure with its message', async () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in' })
    const r = await askWithFakeBinary(createAskCapability, { stdout, exitCode: 1 })
    expect(r.answer).toEqual({ ok: false, message: 'Claude Code failed (success): Not logged in' })
  })

  it('a non-success subtype is a failure', async () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: false })
    const r = await askWithFakeBinary(createAskCapability, { stdout, stderr: 'too many turns' })
    expect(r.answer).toEqual({ ok: false, message: 'Claude Code failed (error_max_turns): too many turns' })
  })

  it('garbage with a non-zero exit is a failure with the stderr tail', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: 'oops', stderr: 'boom', exitCode: 2 })
    expect(r.answer).toEqual({ ok: false, message: 'Claude Code exited with code 2: boom' })
  })

  it('an unresolvable command throws', async () => {
    await expect(
      askWithFakeBinary(createAskCapability, { stdout: '', unresolvable: true, profile: { command: 'claude' } }),
    ).rejects.toThrow("Claude Code command 'claude' was not found.")
  })
})
