import { describe, expect, it } from 'vitest'
import {
  compareMatches,
  foldExact,
  foldLoose,
  matchPath,
  type PathMatch,
  parseQuery,
  preparePath,
} from '../src/renderer/filter/match'

const match = (path: string, query: string): PathMatch | null => matchPath(preparePath(path), parseQuery(query))
/** The matched substrings of `path` (what the row highlights). */
const marked = (path: string, query: string): string[] | undefined =>
  match(path, query)?.ranges.map(([start, end]) => path.slice(start, end))

const NFD_SUBE = `${'ş'.normalize('NFD')}ube.ts`

describe('folding', () => {
  it.each([
    ['İ', 'i'],
    ['I', 'i'],
    ['ı', 'i'],
    ['i', 'i'],
    ['Ş', 'ş'],
    ['Ç', 'ç'],
    ['Ğ', 'ğ'],
    ['Ö', 'ö'],
    ['Ü', 'ü'],
    ['ş', 'ş'],
  ])('exact fold %s → %s', (from, to) => {
    expect(foldExact(from)).toBe(to)
  })

  it.each([
    ['ç', 'c'],
    ['ğ', 'g'],
    ['ö', 'o'],
    ['ş', 's'],
    ['ü', 'u'],
    ['İ', 'i'],
    ['é', 'e'],
    ['文', '文'],
    ['🎉', '🎉'],
  ])('diacritic-insensitive fold %s → %s', (from, to) => {
    expect(foldLoose(from)).toBe(to)
  })
})

describe('parseQuery', () => {
  it('splits on whitespace and drops empty terms', () => {
    expect(parseQuery('  src   ma ')).toHaveLength(2)
    expect(parseQuery('   ')).toEqual([])
  })
})

describe('matchPath: Turkish and Unicode', () => {
  it.each([
    ['İstanbul.ts', 'istanbul'],
    ['istanbul.ts', 'İSTANBUL'],
    ['ılık.md', 'ilik'],
    ['ılık.md', 'ILIK'],
    ['ILIK.md', 'ılık'],
    ['şirket/ödeme_işlemi.ts', 'ödeme'],
    ['şirket/ödeme_işlemi.ts', 'ŞİRKET'],
    ['İçerik.md', 'içerik'],
    ['şube.ts', 'şu'],
  ])('%s matches %s exactly (not as a diacritic fallback)', (path, query) => {
    expect(match(path, query)).toMatchObject({ loose: false })
  })

  it('an NFD path (macOS) matches an NFC query, highlighting the whole s + combining cedilla', () => {
    expect(match(NFD_SUBE, 'şu')).toMatchObject({ loose: false, ranges: [[0, 3]] })
    expect(marked(NFD_SUBE, 'ş')).toEqual(['ş'.normalize('NFD')])
  })

  it('an NFD query matches an NFC path', () => {
    expect(marked('şube.ts', 'şu')).toEqual(['şu'])
  })

  it.each([
    ['İçerik.md', 'icerik'],
    ['şirket/ödeme_işlemi.ts', 'odeme islemi'],
    ['şube.ts', 'su'],
    ['çğöşü.txt', 'cgosu'],
  ])('%s matches %s only without diacritics (ranked lower)', (path, query) => {
    expect(match(path, query)).toMatchObject({ loose: true })
  })

  it('an exact-diacritic match outranks a diacritic-insensitive one', () => {
    const exact = match('şube.ts', 'şu') as PathMatch
    const loose = match('sube.ts', 'şu') as PathMatch
    expect(loose.loose).toBe(true)
    expect(compareMatches(exact, loose)).toBeLessThan(0)
  })

  it('never splits a combining mark from its base letter', () => {
    const path = `o${'̈'}deme.ts`
    expect(marked(path, 'ö')).toEqual([`o${'̈'}`])
    expect(marked(path, 'od')).toEqual([`o${'̈'}d`])
  })

  it.each([
    ['docs/🎉party.md', 'party', ['party']],
    ['docs/🎉party.md', '🎉', ['🎉']],
    ['👨‍👩‍👧.txt', '👨‍👩‍👧', ['👨‍👩‍👧']],
    ['文档/说明.md', '说明', ['说明']],
    ['𝒜lpha.ts', 'lpha', ['lpha']],
  ])('%s with %s highlights %o (emoji, ZWJ, CJK, astral)', (path, query, parts) => {
    expect(marked(path, query)).toEqual(parts)
  })

  it('a ZWJ emoji is never matched by one of its parts', () => {
    expect(match('👨‍👩‍👧.txt', '👨')).toBeNull()
  })
})

describe('matchPath: fuzzy scoring', () => {
  it('a path-segment query matches across the separator, contiguously', () => {
    expect(marked('src/main.ts', 'src/ma')).toEqual(['src/ma'])
  })

  it('terms are AND-ed; each may hit anywhere', () => {
    expect(marked('src/renderer/store.ts', 'store src')).toEqual(['src', 'store'])
    expect(match('src/renderer/store.ts', 'store zz')).toBeNull()
  })

  it('a subsequence matches; a non-subsequence does not', () => {
    expect(match('src/renderer/store.ts', 'srst')).not.toBeNull()
    expect(match('src/renderer/store.ts', 'tss')).toBeNull()
  })

  it.each([
    ['git-changes-panel.ts', 'gcp', ['g', 'c', 'p']],
    ['GitChangesPanel.tsx', 'gcp', ['G', 'C', 'P']],
    ['a_bee_cat.ts', 'abc', ['a', 'b', 'c']],
  ])('%s with %s prefers word starts: %o', (path, query, parts) => {
    expect(marked(path, query)).toEqual(parts)
  })

  it.each([
    ['src/index.ts', 'in/dex/x.ts', 'index'],
    ['lib/store.ts', 'store/old/lib.ts', 'store'],
    ['a/main.ts', 'a/m-a-i-n.ts', 'main'],
    ['src/MainView.tsx', 'src/remain-view.tsx', 'mv'],
  ])('%s outranks %s for %s (basename, consecutive, word starts)', (better, worse, query) => {
    const a = match(better, query) as PathMatch
    const b = match(worse, query) as PathMatch
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(compareMatches(a, b)).toBeLessThan(0)
  })

  it('a prepared path is memoized', () => {
    expect(preparePath('a/b.ts')).toBe(preparePath('a/b.ts'))
  })

  it('stays fast on thousands of paths', () => {
    const paths = Array.from({ length: 5000 }, (_, i) => `packages/module-${i}/src/renderer/component-${i}.tsx`)
    const query = parseQuery('mod rend comp')
    const started = performance.now()
    const hits = paths.filter((p) => matchPath(preparePath(p), query))
    expect(hits).toHaveLength(paths.length)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})
