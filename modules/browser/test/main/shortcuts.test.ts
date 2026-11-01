import { expect, it } from 'vitest'
import { resolveShortcut } from '../../src/main/shortcuts'

const key = (
  k: string,
  mods: Partial<{ meta: boolean; control: boolean; shift: boolean; alt: boolean }> = {},
  type = 'keyDown',
) => ({
  type,
  key: k,
  code: k.length === 1 && /[a-z]/i.test(k) ? `Key${k.toUpperCase()}` : k,
  meta: false,
  control: false,
  shift: false,
  alt: false,
  ...mods,
})

it.each([
  ['darwin', key('C', { meta: true, shift: true }), 'togglePicker'],
  ['linux', key('C', { control: true, shift: true }), 'togglePicker'],
  ['darwin', key('l', { meta: true }), 'focusAddress'],
  ['linux', key('l', { control: true }), 'focusAddress'],
  ['darwin', key('r', { meta: true }), 'reload'],
  ['linux', key('F5'), 'reload'],
  ['darwin', key('F12'), 'devtools'],
  ['darwin', key('i', { meta: true, alt: true }), 'devtools'],
  ['darwin', key('=', { meta: true }), 'zoomIn'],
  ['linux', key('-', { control: true }), 'zoomOut'],
  ['darwin', { ...key('0', { meta: true }), code: 'Digit0' }, 'zoomReset'],
  ['darwin', key('r', { control: true }), null],
  ['darwin', key('r', { meta: true }, 'keyUp'), null],
  ['darwin', key('C'), null],
])('%s %o → %s', (platform, input, action) => expect(resolveShortcut(input, platform)).toBe(action))
