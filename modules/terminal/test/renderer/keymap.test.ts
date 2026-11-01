import { expect, test } from 'vitest'
import { classifyKey, type KeyLike, type KeyPlatform, keyPlatform } from '../../src/renderer/view/keymap'

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
])('%s %o sel=%s → %s', (platform, e, sel, action) => expect(classifyKey(e, platform, sel)).toBe(action))

test.each([
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'mac'],
  ['Mozilla/5.0 (X11; Linux x86_64)', 'other'],
])('keyPlatform(%s) → %s', (ua, p) => expect(keyPlatform(ua)).toBe(p))
