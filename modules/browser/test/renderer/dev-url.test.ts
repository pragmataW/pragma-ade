import { expect, it } from 'vitest'
import { devUrlLabel } from '../../src/renderer/lib/dev-url'
import { buildTab } from '../lib/builders'

it.each([
  [buildTab({ url: 'http://localhost:5173/x' }), 'localhost:5173'],
  [buildTab({ url: 'http://127.0.0.1:4000/' }), '127.0.0.1:4000'],
  [buildTab({ url: 'http://[::1]:3000/' }), '[::1]:3000'],
  [buildTab({ url: 'https://a.test/' }), null],
  [buildTab({ url: 'http://localhost:5173/', loadError: { code: -102, description: 'REFUSED' } }), null],
  [buildTab({ url: '' }), null],
  [null, null],
])('%#: devUrlLabel', (tab, expected) => expect(devUrlLabel(tab)).toBe(expected))
