import { expect, test } from 'vitest'
import { classifyKey, isNewlineKey, type KeyLike, type KeyPlatform, keyPlatform } from '../../src/renderer/view/keymap'

test.each<[KeyPlatform, KeyLike, boolean, string | null]>([
  ['mac', { key: 'c', metaKey: true }, true, 'copy'],
  ['mac', { key: 'c', metaKey: true }, false, null],
  ['mac', { key: 'v', metaKey: true }, false, 'paste'],
  ['mac', { key: 'f', metaKey: true }, false, 'search'],
  ['mac', { key: 'c', ctrlKey: true }, true, null],
  ['mac', { key: 'v', metaKey: true, type: 'keyup' }, false, null],
  ['other', { key: 'c', ctrlKey: true }, true, null],
  ['other', { key: 'C', ctrlKey: true, shiftKey: true }, true, 'copy'],
  ['other', { key: 'V', ctrlKey: true, shiftKey: true }, false, 'paste'],
  ['other', { key: 'f', ctrlKey: true }, false, 'search'],
  ['other', { key: 'v', ctrlKey: true }, false, null],
  ['mac', { key: 'Enter', shiftKey: true }, false, 'newline'],
  ['other', { key: 'Enter', shiftKey: true, type: 'keydown' }, true, 'newline'],
  ['mac', { key: 'Enter' }, false, null],
  ['other', { key: 'Enter' }, false, null],
  ['mac', { key: 'Enter', shiftKey: true, metaKey: true }, false, null],
  ['other', { key: 'Enter', shiftKey: true, ctrlKey: true }, false, null],
  ['mac', { key: 'Enter', shiftKey: true, altKey: true }, false, null],
  ['mac', { key: 'Enter', shiftKey: true, isComposing: true }, false, null],
  ['other', { key: 'Enter', shiftKey: true, type: 'keypress' }, false, null],
  ['other', { key: 'Enter', shiftKey: true, type: 'keyup' }, false, null],
])('%s %o sel=%s → %s', (platform, e, sel, action) => expect(classifyKey(e, platform, sel)).toBe(action))

test.each<[KeyLike, boolean]>([
  [{ key: 'Enter', shiftKey: true, type: 'keydown' }, true],
  [{ key: 'Enter', shiftKey: true, type: 'keypress' }, true],
  [{ key: 'Enter', shiftKey: true, type: 'keyup' }, true],
  [{ key: 'Enter', type: 'keypress' }, false],
  [{ key: 'Enter', shiftKey: true, ctrlKey: true }, false],
  [{ key: 'Enter', shiftKey: true, isComposing: true }, false],
  [{ key: 'a', shiftKey: true }, false],
])('isNewlineKey(%o) → %s', (e, expected) => expect(isNewlineKey(e)).toBe(expected))

test.each([
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'mac'],
  ['Mozilla/5.0 (X11; Linux x86_64)', 'other'],
])('keyPlatform(%s) → %s', (ua, p) => expect(keyPlatform(ua)).toBe(p))
