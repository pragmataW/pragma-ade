// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { parseReactProbe, reactProbeScript } from '../../src/main/picker/react-probe'
import { attachFiber, fakeFiber, mount, q } from '../lib/builders'

beforeEach(() => mount('<button id="b">x</button>'))

it.each([
  [
    '_debugSource',
    fakeFiber({
      name: 'SaveButton',
      debugSource: { fileName: '/repo/src/SaveButton.tsx', lineNumber: 12, columnNumber: 3 },
    }),
    { name: 'SaveButton', source: '/repo/src/SaveButton.tsx:12:3' },
  ],
  [
    'React 19 _debugStack',
    fakeFiber({
      name: 'SaveButton',
      debugStack:
        'Error\n at jsxDEV (http://localhost:5173/node_modules/.vite/deps/react.js:1:2)\n at SaveButton (http://localhost:5173/src/SaveButton.tsx?t=1:12:3)',
    }),
    { name: 'SaveButton', source: 'src/SaveButton.tsx:12:3' },
  ],
  ['skips framework names', { type: 'div', return: { type: { name: 'Provider' }, return: null } }, null],
  ['no fiber', null, null],
])('%s', (_, fiber, expected) => {
  attachFiber(q('#b'), fiber, 'n1')
  expect(parseReactProbe(new window.Function(`return ${reactProbeScript('n1')}`)())).toEqual(expected)
  expect(q('#b').hasAttribute('data-pragma-pick')).toBe(false)
})

it.each([[null], [{}], [{ name: '' }], [{ name: 3 }]])('rejects probe result %#', (raw) =>
  expect(parseReactProbe(raw)).toBeNull(),
)

it('clamps long names', () => expect(parseReactProbe({ name: 'x'.repeat(500) })?.name).toHaveLength(200))
