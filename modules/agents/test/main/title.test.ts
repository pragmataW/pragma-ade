import { expect, it } from 'vitest'
import { deriveSessionTitle } from '../../src/main/sessions/title'

it.each([
  ['  Fix the\nlogin bug', 'Fix the'],
  ['\n\n  second   line  words ', 'second line words'],
  ['x'.repeat(60), `${'x'.repeat(39)}…`],
  ['   \n ', null],
  [undefined, null],
])('deriveSessionTitle(%j)', (prompt, title) => expect(deriveSessionTitle(prompt)).toBe(title))
