import { describe, expect, it } from 'vitest'
import type { WorktreeFolder } from '../src/contract'
import { folderOf, groupByFolder } from '../src/renderer/lib/folders'
import { aWorktree } from './support/builders'

const [main, a, b, c] = ['m', 'a', 'b', 'c'].map((id) => aWorktree('p', { id, isMain: id === 'm' }))
const all = [main, a, b, c].filter((w) => w !== undefined)
const folder = (id: string, worktreeIds: string[]): WorktreeFolder => ({ id, name: id, collapsed: false, worktreeIds })

describe('groupByFolder', () => {
  it('everything is at the root without folders', () => {
    expect(groupByFolder(all, [])).toEqual({ root: all, folders: [] })
  })

  it('members keep the worktree order; unknown ids and second claims are ignored', () => {
    const one = folder('one', ['c', 'a', 'gone'])
    const two = folder('two', ['a'])
    const tree = groupByFolder(all, [one, two])
    expect(tree.root.map((w) => w.id)).toEqual(['m', 'b'])
    expect(tree.folders.map((v) => [v.folder.id, v.worktrees.map((w) => w.id)])).toEqual([
      ['one', ['a', 'c']],
      ['two', []],
    ])
  })

  it('folderOf finds the folder of a worktree', () => {
    const one = folder('one', ['a'])
    expect(folderOf([one], 'a')).toBe(one)
    expect(folderOf([one], 'b')).toBeNull()
  })
})
