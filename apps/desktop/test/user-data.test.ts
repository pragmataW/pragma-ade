import { expect, it } from 'vitest'
import { resolveUserDataDir } from '../src/main/user-data'

it.each([
  [{}, '/default'],
  [{ PRAGMA_USER_DATA: '/tmp/x' }, '/tmp/x'],
  [{ PRAGMA_USER_DATA: '  ' }, '/default'],
  [{ PRAGMA_USER_DATA: '' }, '/default'],
])('resolveUserDataDir(%o)', (env, expected) => {
  expect(resolveUserDataDir(env, '/default')).toBe(expected)
})
