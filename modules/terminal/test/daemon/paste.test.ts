import { expect, test } from 'vitest'
import { encodePaste } from '../../packages/pty-daemon/src/paste'

test.each([
  ['a\nb\r\nc', true, '\x1b[200~a\rb\rc\x1b[201~'],
  ['x\x1b[201~rm -rf /\n', true, '\x1b[200~xrm -rf /\r\x1b[201~'], // end-marker injection stripped
  ['a\nb', false, 'a\rb'],
])('encodePaste(%j, %s)', (text, bracketed, out) => expect(encodePaste(text, bracketed)).toBe(out))
