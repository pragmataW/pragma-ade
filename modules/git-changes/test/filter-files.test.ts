import { describe, expect, it } from 'vitest'
import type { ChangedFile } from '../src/contract'
import { filterFiles, nodeRanges } from '../src/renderer/filter/filter-files'
import { parseQuery } from '../src/renderer/filter/match'
import { buildGroups, type TreeNode } from '../src/renderer/tree/build-tree'
import { changed } from './helpers/lists'

const FILES: ChangedFile[] = [
  ...changed(['şirket/ödeme_işlemi.ts', 'İçerik.md', 'src/main.ts', 'src/odeme.ts']),
  { ...(changed(['src/main.ts'])[0] as ChangedFile), staged: true },
]
const paths = (files: readonly ChangedFile[]) => files.map((f) => f.path)
const find = (nodes: readonly TreeNode[], id: string): TreeNode | undefined =>
  nodes.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => n.id === id) ??
  nodes.flatMap((n) => (n.children ? [find(n.children, id)] : [])).find(Boolean)

describe('filterFiles', () => {
  it('an empty query keeps every entry and is inactive', () => {
    const f = filterFiles(FILES, parseQuery(' '))
    expect(f.active).toBe(false)
    expect(f.visible).toBe(FILES)
    expect(f.total).toBe(FILES.length)
  })

  it('keeps matches, exact diacritics first, then by score', () => {
    const f = filterFiles(FILES, parseQuery('ödeme'))
    expect(paths(f.visible)).toEqual(['şirket/ödeme_işlemi.ts', 'src/odeme.ts'])
    expect(f.matches.get('src/odeme.ts')?.loose).toBe(true)
  })

  it('a staged and an unstaged entry of one path both match', () => {
    const f = filterFiles(FILES, parseQuery('main'))
    expect(f.visible.map((x) => Boolean(x.staged))).toEqual([false, true])
  })

  it('nothing matches: no entries, total kept', () => {
    const f = filterFiles(FILES, parseQuery('zzz'))
    expect(f).toMatchObject({ active: true, visible: [], total: FILES.length })
  })
})

describe('buildGroups with a filter', () => {
  it('groups carry the unfiltered count next to the matched one', () => {
    const f = filterFiles(FILES, parseQuery('src'))
    const nodes = buildGroups(f.visible, { grouped: true, flat: true, all: FILES })
    expect(nodes.map((n) => [n.group, n.fileCount, n.totalCount])).toEqual([
      ['staged', 1, 1],
      ['unstaged', 2, 4],
    ])
  })
})

describe('nodeRanges', () => {
  const f = filterFiles(FILES, parseQuery('src/ma'))
  const tree = buildGroups(
    f.visible.filter((x) => !x.staged),
    { grouped: false, flat: false },
  )

  it('a file row highlights within its basename', () => {
    const file = find(tree, 'f:src/main.ts') as TreeNode
    expect(nodeRanges(file, f.matches)).toEqual([[0, 2]])
  })

  it('a directory row highlights what its files matched inside its own name', () => {
    const dir = find(tree, 'd:src') as TreeNode
    expect(nodeRanges(dir, f.matches)).toEqual([[0, 3]])
  })

  it('a flat row (full path) highlights the whole match', () => {
    const [flat] = buildGroups(f.visible, { grouped: false, flat: true })
    expect(nodeRanges(flat as TreeNode, f.matches)).toEqual([[0, 6]])
  })

  it('no filter: no ranges', () => {
    const [flat] = buildGroups(FILES, { grouped: false, flat: true })
    expect(nodeRanges(flat as TreeNode, new Map())).toEqual([])
  })
})
