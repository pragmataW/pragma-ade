import { describe, expect, it } from 'vitest'
import { fileIconName, folderIconName } from '../src/lib/file-icons'

describe('fileIconName', () => {
  it.each([
    ['src/index.ts', 'typescript'],
    ['App.tsx', 'react_ts'],
    ['package.json', 'nodejs'],
    ['Dockerfile', 'docker'],
    ['.gitignore', 'git'],
    ['README.md', 'readme'],
    ['notes.md', 'markdown'],
    ['a/b/foo.spec.ts', 'test-ts'],
    ['main.py', 'python'],
    ['no-extension-file', 'file'],
    ['weird.unknownext', 'file'],
  ])('%s → %s', (path, icon) => {
    expect(fileIconName(path)).toBe(icon)
  })

  it('matches names case-insensitively and prefers the longest extension', () => {
    expect(fileIconName('PACKAGE.JSON')).toBe('nodejs')
    expect(fileIconName('x.d.ts')).toBe('typescript-def')
  })

  it('uses the light variant when one exists', () => {
    expect(fileIconName('Cargo.toml', { light: true })).toBe('toml_light')
    expect(fileIconName('Cargo.toml')).toBe('toml')
  })
})

describe('folderIconName', () => {
  it.each([
    ['src', false, 'folder-src'],
    ['src', true, 'folder-src-open'],
    ['node_modules', false, 'folder-node'],
    ['my-folder', false, 'folder'],
    ['my-folder', true, 'folder-open'],
  ])('%s (open=%s) → %s', (name, open, icon) => {
    expect(folderIconName(name, { open })).toBe(icon)
  })
})
