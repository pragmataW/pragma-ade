import { describe, expect, it } from 'vitest'
import { languageFor, toCommentContext } from '../src/renderer/diff/selection'

const TEXTS = { old: 'x1\r\nx2\r\n', new: 'l1\nl2\nl3\nl4\n' }

describe('toCommentContext', () => {
  it.each([
    [
      'new side range',
      { start: 2, end: 3, side: 'additions' },
      { path: 'a.ts' },
      { lineStart: 2, lineEnd: 3, snippet: 'l2\nl3', language: 'ts', diffSide: 'new', filePath: 'a.ts' },
    ],
    [
      'old side CRLF range on a renamed file',
      { start: 1, end: 2, side: 'deletions' },
      { path: 'n.ts', oldPath: 'o.ts' },
      { lineStart: 1, lineEnd: 2, snippet: 'x1\nx2', diffSide: 'old', filePath: 'o.ts' },
    ],
    [
      'reversed range',
      { start: 3, end: 2, side: 'additions' },
      { path: 'a.ts' },
      { lineStart: 2, lineEnd: 3, snippet: 'l2\nl3' },
    ],
    [
      'mixed sides collapse to the end line',
      { start: 5, side: 'deletions', end: 4, endSide: 'additions' },
      { path: 'a.ts' },
      { lineStart: 4, lineEnd: 4, snippet: 'l4', diffSide: 'new' },
    ],
  ] as const)('%s', (_name, range, file, expected) => {
    expect(toCommentContext(range, TEXTS, file)).toMatchObject({ source: 'diff', ...expected })
  })

  it('a side without text gives an empty snippet', () => {
    expect(
      toCommentContext({ start: 1, end: 1, side: 'deletions' }, { old: null, new: 'a' }, { path: 'a.ts' }).snippet,
    ).toBe('')
  })
})

describe('languageFor', () => {
  it.each([
    ['src/a.ts', 'ts'],
    ['b.TSX', 'tsx'],
    ['x.mjs', 'js'],
    ['run.sh', 'bash'],
    ['c.yaml', 'yaml'],
    ['Makefile', ''],
    ['notes.unknown', ''],
  ])('%s → %s', (path, lang) => {
    expect(languageFor(path)).toBe(lang)
  })
})
