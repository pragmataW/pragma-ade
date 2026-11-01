import { describe, expect, it } from 'vitest'
import { countLines, mergeChanges, parseNameStatusZ, parseNumstatZ } from '../src/main/parse'

describe('-z parsers', () => {
  it('parseNameStatusZ maps statuses, renames and copies', () => {
    expect(
      parseNameStatusZ('M\0src/a.ts\0R087\0old.txt\0new.txt\0D\0gone.txt\0C100\0a\0b\0T\0t.sh\0U\0u.ts\0'),
    ).toEqual([
      { status: 'M', path: 'src/a.ts' },
      { status: 'R', path: 'new.txt', oldPath: 'old.txt' },
      { status: 'D', path: 'gone.txt' },
      { status: 'A', path: 'b' },
      { status: 'M', path: 't.sh' },
      { status: 'M', path: 'u.ts' },
    ])
  })

  it('parseNumstatZ reads counts, binary entries and renames keyed by the new path', () => {
    const out = parseNumstatZ('3\t1\tsrc/a.ts\0-\t-\tlogo.png\0' + '0\t0\t\0old.txt\0new.txt\0')
    expect([...out]).toEqual([
      ['src/a.ts', { additions: 3, deletions: 1, binary: false }],
      ['logo.png', { additions: 0, deletions: 0, binary: true }],
      ['new.txt', { additions: 0, deletions: 0, binary: false }],
    ])
  })

  it.each([
    ['name-status', () => parseNameStatusZ('A\0dir with space/ünï "q".txt\0')[0]?.path],
    ['numstat', () => [...parseNumstatZ('1\t0\tdir with space/ünï "q".txt\0').keys()][0]],
  ])('a unicode path round-trips through %s', (_name, read) => {
    expect(read()).toBe('dir with space/ünï "q".txt')
  })

  it('empty input gives empty results', () => {
    expect(parseNameStatusZ('')).toEqual([])
    expect(parseNumstatZ('').size).toBe(0)
  })

  it('mergeChanges joins counts and sorts by path', () => {
    const files = mergeChanges(
      [
        { status: 'M', path: 'b.ts' },
        { status: 'A', path: 'a.png' },
      ],
      new Map([['b.ts', { additions: 2, deletions: 1, binary: false }]]),
    )
    expect(files).toEqual([
      { status: 'A', path: 'a.png', additions: 0, deletions: 0, binary: false },
      { status: 'M', path: 'b.ts', additions: 2, deletions: 1, binary: false },
    ])
  })

  it.each([
    ['a\nb\n', 2],
    ['a\nb', 2],
    ['', 0],
    ['\n', 1],
  ])('countLines(%j) = %i', (text, n) => {
    expect(countLines(text)).toBe(n)
  })
})
