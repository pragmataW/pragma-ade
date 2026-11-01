import { expect, it } from 'vitest'
import { formatArgs, formatCommandLine, quoteArg, splitArgs, tryParseArgs } from '../../src/contract'

it.each([
  ['', []],
  ['--dangerously-skip-permissions', ['--dangerously-skip-permissions']],
  ['  -a   b ', ['-a', 'b']],
  [`--msg "two words"`, ['--msg', 'two words']],
  [`--msg 'it''s'`, ['--msg', 'its']],
  [`"a \\"q\\" b"`, ['a "q" b']],
  [`'$HOME' ~ *`, ['$HOME', '~', '*']],
  [`a\\ b`, ['a b']],
  [`x="" y`, ['x=', 'y']],
  [`""`, ['']],
  ['a\nb\tc', ['a', 'b', 'c']],
  [`"keep \\n and \\$"`, ['keep \\n and $']],
])('splitArgs(%j)', (input, expected) => expect(splitArgs(input)).toEqual(expected))

it('unterminated quote', () =>
  expect(tryParseArgs(`--x "abc`)).toEqual({ ok: false, code: 'unterminatedQuote', index: 4 }))
it('unterminated single quote', () => expect(tryParseArgs(`a 'b`)).toMatchObject({ ok: false, index: 2 }))
it('trailing backslash', () => expect(tryParseArgs('a\\')).toMatchObject({ ok: false, code: 'trailingBackslash' }))
it('tryParseArgs ok', () => expect(tryParseArgs('-a b')).toEqual({ ok: true, args: ['-a', 'b'] }))

it('formatCommandLine quotes only when needed', () =>
  expect(formatCommandLine('dgc', ['--dangerously-skip-permissions', 'two words', "it's"])).toBe(
    `dgc --dangerously-skip-permissions 'two words' 'it'\\''s'`,
  ))
it('formatArgs of no args is empty', () => expect(formatArgs([])).toBe(''))
it('formatCommandLine without args is the command', () => expect(formatCommandLine('claude', [])).toBe('claude'))

it('round-trips', () => {
  const a = ['a b', '', "x'y", '$Z', '"q"']
  expect(splitArgs(a.map(quoteArg).join(' '))).toEqual(a)
})
