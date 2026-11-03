import { describe, expect, it } from 'vitest'
import { keyToAction } from '../src/renderer/keyboard'

const key = (
  k: string,
  mods: Partial<Record<'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'targetIsEditable', boolean>> = {},
  code = `Key${k.toUpperCase()}`,
) => ({
  key: k,
  code,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  targetIsEditable: false,
  ...mods,
})

describe('keyToAction', () => {
  it.each([
    [key('j'), 'nextFile'],
    [key('k'), 'prevFile'],
    [key('n'), 'nextChange'],
    [key('N', { shiftKey: true }), 'prevChange'],
    [key('j', { targetIsEditable: true }), null],
    [key('n', { metaKey: true }), null],
    [key('k', { ctrlKey: true }), null],
    [key('j', { altKey: true }), null],
    [key('x'), null],
    [key('f', { metaKey: true }), 'find'],
    [key('f', { ctrlKey: true }), 'find'],
    [key('F', { metaKey: true }), 'find'],
    [key('f', { metaKey: true, targetIsEditable: true }), 'find'],
    [key('f', { metaKey: true, shiftKey: true }), null],
    [key('f'), null],
    // ⌥⌘F on macOS types `ƒ`: the filter goes by the physical key.
    [key('ƒ', { metaKey: true, altKey: true }, 'KeyF'), 'filter'],
    [key('f', { ctrlKey: true, altKey: true }), 'filter'],
    [key('f', { ctrlKey: true, altKey: true, targetIsEditable: true }), 'filter'],
    [key('f', { altKey: true }), null],
    [key('f', { metaKey: true, altKey: true, shiftKey: true }), null],
  ])('%o → %s', (e, action) => {
    expect(keyToAction(e)).toBe(action)
  })
})
