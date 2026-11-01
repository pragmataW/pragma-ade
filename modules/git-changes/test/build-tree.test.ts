import { describe, expect, it } from 'vitest'
import type { ChangedFile } from '../src/contract'
import { buildFlatList, buildTree, leafOrder, type TreeNode } from '../src/renderer/tree/build-tree'

const file = (path: string, status: ChangedFile['status'] = 'M'): ChangedFile => ({
  path,
  status,
  additions: 1,
  deletions: 0,
  binary: false,
})
const files = (...paths: string[]) => paths.map((p) => file(p))
const names = (nodes: TreeNode[] | undefined) => (nodes ?? []).map((n) => n.name)

describe('buildTree', () => {
  it('compresses single-child chains', () => {
    const root = buildTree(files('src/main/git/service.ts', 'src/main/git/parse.ts', 'src/app.ts'))
    expect(names(root)).toEqual(['src'])
    const src = root[0] as TreeNode
    expect(names(src.children)).toEqual(['main/git', 'app.ts'])
    const git = src.children?.[0] as TreeNode
    expect([src.fileCount, git.fileCount]).toEqual([3, 2])
    expect(git).toMatchObject({ id: 'd:src/main/git', path: 'src/main/git', kind: 'dir' })
    expect(names(git.children)).toEqual(['parse.ts', 'service.ts'])
  })

  it('a lone a/b/c.ts becomes dir a/b with child c.ts (files never merge into a dir name)', () => {
    const [dir] = buildTree(files('a/b/c.ts'))
    expect(dir).toMatchObject({ name: 'a/b', path: 'a/b', kind: 'dir', fileCount: 1 })
    expect(dir?.children?.[0]).toMatchObject({ id: 'f:a/b/c.ts', name: 'c.ts', path: 'a/b/c.ts', kind: 'file' })
  })

  it('dirs before files, alpha order', () => {
    const root = buildTree(files('zeta.ts', 'b/x.ts', 'Alpha.md', 'a/y.ts', 'a/z.ts'))
    expect(names(root)).toEqual(['a', 'b', 'Alpha.md', 'zeta.ts'])
  })

  it('buildFlatList keeps the order with full paths', () => {
    const flat = buildFlatList(files('b/x.ts', 'a.ts', 'c/d/e.ts'))
    expect(flat.map((n) => [n.name, n.path, n.kind])).toEqual([
      ['b/x.ts', 'b/x.ts', 'file'],
      ['a.ts', 'a.ts', 'file'],
      ['c/d/e.ts', 'c/d/e.ts', 'file'],
    ])
  })

  it('leafOrder follows display order', () => {
    expect(leafOrder(buildTree(files('README.md', 'src/b.ts', 'src/a/c.ts', 'docs/x.md')))).toEqual([
      'docs/x.md',
      'src/a/c.ts',
      'src/b.ts',
      'README.md',
    ])
  })
})
