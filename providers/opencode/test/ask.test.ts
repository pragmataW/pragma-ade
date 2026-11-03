import { INLINE_PROMPT_MAX_CHARS } from '@pragma/module-agents/contract'
import { askWithFakeBinary } from '@pragma/module-cli-integration/testing'
import { describe, expect, it } from 'vitest'
import { createAskCapability } from '../src/main/ask.capability'

const RUN = ['run', '--standalone', '--format', 'json', '--agent', 'plan']
const line = (o: object) => JSON.stringify({ timestamp: 1, sessionID: 'ses_1', ...o })
const step = () => line({ type: 'step_start', part: { id: 'p0', type: 'step-start' } })
const text = (t: string, id = 'p1') => line({ type: 'text', part: { id, type: 'text', text: t } })
const tool = () => line({ type: 'tool_use', part: { id: 't1', type: 'tool', tool: 'read' } })
const jsonl = (...lines: string[]) => `${lines.join('\n')}\n`

describe.skipIf(process.platform === 'win32')('opencode ask capability', () => {
  it('runs opencode run --format json with the plan agent, never --auto', async () => {
    const r = await askWithFakeBinary(createAskCapability, {
      stdout: jsonl(step(), text('4')),
      prompt: 'What is 2+2?',
      profile: { command: 'oc', args: ['--auto', '-m', 'anthropic/sonnet'] },
    })
    expect(r.resolved).toEqual(['oc'])
    expect(r.record.argv).toEqual([...RUN, '-m', 'anthropic/sonnet', 'What is 2+2?'])
    expect(r.record.argv).not.toContain('--auto')
    expect(r.record.stdin).toBe('')
    expect(r.answer).toEqual({ ok: true, text: '4' })
  })

  it('forwards --model=… as -m and keeps the profile env', async () => {
    const r = await askWithFakeBinary(createAskCapability, {
      stdout: jsonl(text('x')),
      profile: { args: ['--model=a/b'], env: { OPENCODE_CONFIG: '/c' } },
    })
    expect(r.record.argv).toEqual([...RUN, '-m', 'a/b', 'What is 2+2?'])
    expect(r.record.env.OPENCODE_CONFIG).toBe('/c')
  })

  it('pads a prompt that looks like a flag', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: jsonl(text('x')), prompt: '--help me' })
    expect(r.record.argv.at(-1)).toBe(' --help me')
  })

  it('a long prompt is attached as a file', async () => {
    const prompt = 'q'.repeat(INLINE_PROMPT_MAX_CHARS + 1)
    const r = await askWithFakeBinary(createAskCapability, { stdout: jsonl(text('x')), prompt })
    expect(r.written).toHaveLength(1)
    expect(r.written[0]?.name).toBe('question.md')
    expect(r.written[0]?.contents).toBe(prompt)
    expect(r.record.argv.slice(RUN.length)).toEqual([
      '--file',
      r.written[0]?.path,
      'The attached file question.md is a question from another coding agent. Answer it.',
    ])
  })

  it('the answer is the text of the last step that has text', async () => {
    const stdout = jsonl(
      step(),
      text('Let me look.'),
      tool(),
      step(),
      text('The answer', 'a'),
      text('is 4.', 'b'),
      step(),
    )
    const r = await askWithFakeBinary(createAskCapability, { stdout })
    expect(r.answer).toEqual({ ok: true, text: 'The answer\n\nis 4.' })
  })

  it('skips lines that are not JSON events', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: jsonl('noise', text('ok'), '{"x":1}') })
    expect(r.answer).toEqual({ ok: true, text: 'ok' })
  })

  it.each([
    [{ message: 'Model not found' }, 'Model not found'],
    [{ name: 'APIError', data: { message: 'rate limited' } }, 'rate limited'],
    [{ name: 'Weird' }, '{"name":"Weird"}'],
  ])('an error event %j is a failure', async (error, message) => {
    const r = await askWithFakeBinary(createAskCapability, {
      stdout: jsonl(step(), line({ type: 'error', error })),
      exitCode: 1,
    })
    expect(r.answer).toEqual({ ok: false, message: `OpenCode failed: ${message}` })
  })

  it('no text is a failure with the stderr tail', async () => {
    const r = await askWithFakeBinary(createAskCapability, { stdout: '', stderr: 'not configured', exitCode: 1 })
    expect(r.answer).toEqual({ ok: false, message: 'OpenCode returned no answer (exit 1): not configured' })
  })

  it('an unresolvable command throws', async () => {
    await expect(
      askWithFakeBinary(createAskCapability, { stdout: '', unresolvable: true, profile: { command: 'opencode' } }),
    ).rejects.toThrow("OpenCode command 'opencode' was not found.")
  })
})
