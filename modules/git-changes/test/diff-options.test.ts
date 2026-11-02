import { describe, expect, it, vi } from 'vitest'
import type { FileDiffContents, FileVersion } from '../src/contract'
import {
  buildDiffOptions,
  changeRunStarts,
  firstChangedLine,
  nextChangeTop,
  placeholderFor,
  toFileContents,
} from '../src/renderer/diff/diff-options'
import { formatBytes } from '../src/renderer/lib/format'

const text = (contents: string): FileVersion => ({ kind: 'text', contents })
const ABSENT: FileVersion = { kind: 'absent' }
const BINARY: FileVersion = { kind: 'binary' }
const UNREADABLE: FileVersion = { kind: 'unreadable' }
const big = (bytes: number): FileVersion => ({ kind: 'tooLarge', bytes })
const contents = (old: FileVersion, next: FileVersion): FileDiffContents => ({
  path: 'a.ts',
  status: 'M',
  old,
  new: next,
})

describe('buildDiffOptions', () => {
  it('returns exactly the planned options', () => {
    const onRange = vi.fn()
    expect(buildDiffOptions({ diffStyle: 'split', showFullFile: true, theme: 'light', onRange })).toEqual({
      diffStyle: 'split',
      expandUnchanged: true,
      hunkSeparators: 'line-info',
      expansionLineCount: 20,
      parseDiffOptions: { context: 3 },
      theme: { dark: 'pierre-dark', light: 'pierre-light' },
      themeType: 'light',
      overflow: 'scroll',
      disableFileHeader: true,
      lineHoverHighlight: 'both',
      enableGutterUtility: true,
      onGutterUtilityClick: onRange,
      enableLineSelection: true,
      onLineSelectionEnd: expect.any(Function),
      unsafeCSS: expect.stringContaining('[data-line-annotation][data-selected-line]'),
    })
  })

  it('a cleared selection does not open the composer', () => {
    const onRange = vi.fn()
    const options = buildDiffOptions({ diffStyle: 'unified', showFullFile: false, theme: 'dark', onRange })
    options.onLineSelectionEnd?.(null)
    expect(onRange).not.toHaveBeenCalled()
    options.onLineSelectionEnd?.({ start: 1, end: 2, side: 'additions' })
    expect(onRange).toHaveBeenCalledWith({ start: 1, end: 2, side: 'additions' })
  })
})

describe('placeholders and file contents', () => {
  it.each([
    ['text/text', contents(text('a'), text('b')), null],
    ['new text file', contents(ABSENT, text('b')), null],
    ['deleted text file', contents(text('a'), ABSENT), null],
    ['binary', contents(BINARY, BINARY), { kind: 'binary' }],
    ['tooLarge wins over binary', contents(BINARY, big(5)), { kind: 'tooLarge', bytes: 5 }],
    ['binary wins over unreadable', contents(UNREADABLE, BINARY), { kind: 'binary' }],
    ['unreadable', contents(text('a'), UNREADABLE), { kind: 'unreadable' }],
    ['both absent', contents(ABSENT, ABSENT), { kind: 'unreadable' }],
  ])('placeholderFor %s', (_name, c, expected) => {
    expect(placeholderFor(c)).toEqual(expected)
  })

  it.each([
    [text('x\n'), { name: 'a.ts', contents: 'x\n' }],
    [ABSENT, null],
    [BINARY, null],
    [big(3), null],
  ])('toFileContents(%o)', (v, expected) => {
    expect(toFileContents('a.ts', v)).toEqual(expected)
  })
})

describe('helpers', () => {
  it.each([
    [1_258_291, '1.2 MB'],
    [1_048_576, '1 MB'],
    [512, '512 B'],
    [2048, '2 KB'],
  ])('formatBytes(%i) = %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })

  it.each([
    ['a\nb\nc\n', 'a\nB\nc\n', 2],
    ['a\n', 'a\nb\n', 2],
    ['', 'x\n', 1],
    ['same\n', 'same\n', 1],
    [null, 'x\n', 1],
  ])('firstChangedLine(%j, %j) = %i', (old, next, line) => {
    expect(firstChangedLine(old, next)).toBe(line)
  })

  it('changeRunStarts keeps the first row of each contiguous run', () => {
    expect(changeRunStarts(['context', 'change-deletion', 'change-addition', 'context', 'change-addition'])).toEqual([
      1, 4,
    ])
  })

  it.each([
    [[10, 50, 90], 0, 'next', 10],
    [[10, 50, 90], 50, 'next', 90],
    [[10, 50, 90], 90, 'next', null],
    [[10, 50, 90], 50, 'prev', 10],
    [[10, 50, 90], 5, 'prev', null],
  ] as const)('nextChangeTop(%o, %i, %s) = %s', (tops, scrollTop, direction, expected) => {
    expect(nextChangeTop(tops, scrollTop, direction)).toBe(expected)
  })
})
