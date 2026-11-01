import { expect, it } from 'vitest'
import {
  INLINE_PROMPT_MAX_CHARS,
  LONG_PROMPT_FILE,
  longPromptInstruction,
  padFlagLike,
  parseSemver,
  resolvePromptText,
} from '../../src/contract'
import { fakeWriter } from '../support/fakes'

it.each([
  ['-v please', {}, ' -v please'],
  ['update', { singleWord: true }, ' update'],
  ['update', {}, 'update'],
  ['fix it', { singleWord: true }, 'fix it'],
])('padFlagLike(%j,%j)', (p, o, out) => expect(padFlagLike(p, o)).toBe(out))

it('short prompt stays inline', async () =>
  expect(await resolvePromptText(fakeWriter(), 'a\n"b" $c=d')).toEqual({ text: 'a\n"b" $c=d', tempFiles: [] }))

it('long prompt goes to a temp file', async () => {
  const w = fakeWriter('/tmp/s/initial-prompt.md')
  const p = 'x'.repeat(INLINE_PROMPT_MAX_CHARS + 1)
  expect(await resolvePromptText(w, p)).toEqual({
    text: longPromptInstruction('/tmp/s/initial-prompt.md'),
    tempFiles: ['/tmp/s/initial-prompt.md'],
  })
  expect(w.calls).toEqual([[LONG_PROMPT_FILE, p]])
})

it('instruction names the file', () =>
  expect(longPromptInstruction('/p/f.md')).toBe(
    'Your task is in the file /p/f.md. Read the whole file and follow its instructions.',
  ))

it.each([
  ['1.1.36\n', [1, 1, 36]],
  ['opencode v2.2.5', [2, 2, 5]],
  ['v2.0.0-beta.1', [2, 0, 0]],
  ['', null],
])('parseSemver(%j)', (t, v) => expect(parseSemver(t)).toEqual(v))
