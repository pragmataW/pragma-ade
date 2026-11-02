import { describe, expect, it } from 'vitest'
import { parseFileRef } from '../../src/renderer/lib/parse-file-ref'

const W = '/w/repo'

describe('parseFileRef', () => {
  it.each([
    ['src/a.ts', W, { path: 'src/a.ts' }],
    ['src/a.ts:42', W, { path: 'src/a.ts', line: 42 }],
    ['src/a.ts:42:7', W, { path: 'src/a.ts', line: 42, column: 7 }],
    ['src/a.ts#L12', W, { path: 'src/a.ts', line: 12 }],
    ['/w/repo/src/a.ts:3', W, { path: 'src/a.ts', line: 3 }],
    ['./src/a.ts', W, { path: 'src/a.ts' }],
    ['src/my file.ts:2', W, { path: 'src/my file.ts', line: 2 }],
    ['C:\\w\\repo\\src\\a.ts', 'C:\\w\\repo', { path: 'src/a.ts' }],
    ['a.ts', W, { path: 'a.ts' }],
  ])('%j (worktree %j) → %j', (raw, worktree, ref) => expect(parseFileRef(raw, worktree)).toEqual(ref))

  it.each([
    '/etc/passwd',
    '../x/a.ts',
    'src/../../x.ts',
    'https://x.dev/a.ts',
    'C:\\other\\a.ts',
    'README',
    'Makefile',
    '',
    '   ',
    'two\nlines.ts',
    '/w/repo-other/a.ts',
    'src/a.ts:0',
  ])('%j → null', (raw) => expect(parseFileRef(raw, W)).toBeNull())
})
