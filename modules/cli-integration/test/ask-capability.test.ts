import { describe, expect, it } from 'vitest'
import { askSpecSchema, profileArgValue } from '../src/contract'

describe('profileArgValue', () => {
  it.each([
    [['--model', 'opus'], ['--model'], 'opus'],
    [['--model=opus'], ['--model'], 'opus'],
    [['--x', '-m', 'x/y'], ['--model', '-m'], 'x/y'],
    [['--verbose', '--model=a', '--model', 'b'], ['--model'], 'a'],
    [['--model'], ['--model'], undefined],
    [['--model='], ['--model'], undefined],
    [['--dangerously-skip-permissions'], ['--model'], undefined],
    [[], ['--model'], undefined],
  ])('%j with %j → %s', (args, names, expected) => {
    expect(profileArgValue(args, names)).toBe(expected)
  })
})

describe('askSpecSchema', () => {
  const spec = { command: '/bin/claude', args: ['-p'], env: { PATH: '/bin' }, stdin: null }
  it('accepts a full spec', () => expect(askSpecSchema.safeParse(spec).success).toBe(true))
  it('rejects an empty command', () => expect(askSpecSchema.safeParse({ ...spec, command: '' }).success).toBe(false))
})
