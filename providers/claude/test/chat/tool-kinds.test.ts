import { describe, expect, it } from 'vitest'
import { fileEditFor, todoFor, toolKindFor, toolTitleFor } from '../../src/main/chat/tool-kinds'

describe('toolKindFor', () => {
  it.each([
    ['Bash', 'shell'],
    ['BashOutput', 'shell'],
    ['KillShell', 'shell'],
    ['Read', 'read'],
    ['NotebookRead', 'read'],
    ['Grep', 'search'],
    ['Glob', 'search'],
    ['LS', 'search'],
    ['Edit', 'edit'],
    ['MultiEdit', 'edit'],
    ['NotebookEdit', 'edit'],
    ['Write', 'write'],
    ['WebFetch', 'web'],
    ['WebSearch', 'web'],
    ['Task', 'task'],
    ['Agent', 'task'],
    ['TodoWrite', 'todo'],
    ['mcp__x__y', 'other'],
  ])('%s → %s', (name, kind) => expect(toolKindFor(name)).toBe(kind))
})

describe('toolTitleFor', () => {
  it.each([
    ['Bash', { command: 'ls -la' }, 'ls -la'],
    ['Read', { file_path: '/a.ts' }, '/a.ts'],
    ['Edit', { file_path: '/b.ts' }, '/b.ts'],
    ['Write', { file_path: '/c.ts' }, '/c.ts'],
    ['MultiEdit', { file_path: '/d.ts' }, '/d.ts'],
    ['Grep', { pattern: 'foo' }, 'foo'],
    ['Glob', { pattern: '**/*.ts' }, '**/*.ts'],
    ['WebFetch', { url: 'https://x.test' }, 'https://x.test'],
    ['Unknown', { command: 'x' }, undefined],
  ])('%s %o → %s', (name, input, title) => expect(toolTitleFor(name, input)).toBe(title))
})

describe('fileEditFor', () => {
  it.each([
    [
      'Edit',
      { file_path: 'a', old_string: 'x', new_string: 'y' },
      undefined,
      { change: 'edit', hunks: [{ before: 'x', after: 'y' }] },
    ],
    [
      'MultiEdit',
      {
        file_path: 'a',
        edits: [
          { old_string: '1', new_string: '2' },
          { old_string: '3', new_string: '4' },
        ],
      },
      undefined,
      {
        change: 'edit',
        hunks: [
          { before: '1', after: '2' },
          { before: '3', after: '4' },
        ],
      },
    ],
    [
      'Write',
      { file_path: 'a', content: 'new' },
      undefined,
      { change: 'create', hunks: [{ before: '', after: 'new' }] },
    ],
    [
      'Write',
      { file_path: 'a', content: 'new' },
      { originalFile: 'old' },
      { change: 'overwrite', hunks: [{ before: 'old', after: 'new' }] },
    ],
  ])('%s', (name, input, toolUseResult, expected) => {
    expect(fileEditFor(name, input, toolUseResult)).toMatchObject({ kind: 'file-edit', path: 'a', ...expected })
  })

  it('returns undefined for non-edit tools', () => expect(fileEditFor('Bash', { file_path: 'a' })).toBeUndefined())
})

describe('todoFor', () => {
  it('TodoWrite maps statuses pending/active/done', () => {
    const todos = [
      { content: 'a', status: 'pending' },
      { content: 'b', status: 'in_progress' },
      { content: 'c', status: 'completed' },
    ]
    expect(todoFor({ todos })).toEqual([
      { id: '0', text: 'a', status: 'pending' },
      { id: '1', text: 'b', status: 'active' },
      { id: '2', text: 'c', status: 'done' },
    ])
  })
})
