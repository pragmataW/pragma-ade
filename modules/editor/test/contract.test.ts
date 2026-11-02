import { describe, expect, it } from 'vitest'
import {
  EDITOR_TEST_IDS,
  EditorSettingsSchema,
  editorBridge,
  editorSettingsDefaults,
  normalizeFolderKey,
  OpenFileArgsSchema,
} from '../src/contract'

describe('contract', () => {
  it('OpenFileArgsSchema rejects line 0 and empty path', () => {
    expect(() => OpenFileArgsSchema.parse({ worktreeId: 'w', path: 'a.ts', line: 0 })).toThrow()
    expect(() => OpenFileArgsSchema.parse({ worktreeId: 'w', path: '' })).toThrow()
  })

  it.each([
    ['/Users/A/x/', 'darwin', '/users/a/x'],
    ['C:\\Work\\X\\', 'win32', 'c:/work/x'],
    ['/home/A/x', 'linux', '/home/A/x'],
    ['/home/a/./b/../c', 'linux', '/home/a/c'],
  ] as const)('normalizeFolderKey(%s, %s) = %s', (input, platform, expected) => {
    expect(normalizeFolderKey(input, platform)).toBe(expected)
  })

  it('settings defaults parse', () => {
    expect(EditorSettingsSchema.parse(editorSettingsDefaults)).toEqual(editorSettingsDefaults)
  })

  it('editorBridge declares hello/comment/testResponse requests and openFile/openDiff/setTheme/testRequest events', () => {
    expect(editorBridge.name).toBe('editor')
    expect(Object.keys(editorBridge.requests)).toEqual(expect.arrayContaining(['hello', 'comment', 'testResponse']))
    expect(Object.keys(editorBridge.events)).toEqual(['openFile', 'openDiff', 'setTheme', 'testRequest'])
  })

  it('EDITOR_TEST_IDS values are unique', () => {
    const values = Object.values(EDITOR_TEST_IDS)
    expect(new Set(values).size).toBe(values.length)
  })
})
