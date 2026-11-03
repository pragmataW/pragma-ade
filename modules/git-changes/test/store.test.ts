import { beforeEach, describe, expect, it } from 'vitest'
import type { ChangedFile } from '../src/contract'
import { reconcileSelection, revealMode, useGitChangesStore, viewOf } from '../src/renderer/store'

const files = (...paths: string[]): ChangedFile[] =>
  paths.map((path) => ({ path, status: 'M', additions: 0, deletions: 0, binary: false }))
const view = () => viewOf(useGitChangesStore.getState(), 'w')

beforeEach(() => useGitChangesStore.setState({ views: {} }))

describe('selection reconciling', () => {
  it.each([
    ['keeps a listed selection', 'b', ['a', 'b', 'c'], ['a', 'b', 'c'], 'b'],
    ['b removed from [a,b,c] → c', 'b', ['a', 'b', 'c'], ['a', 'c'], 'c'],
    ['last removed → new last', 'c', ['a', 'b', 'c'], ['a', 'b'], 'b'],
    ['empty → null', 'a', ['a'], [], null],
    ['no previous selection → first', null, [], ['a', 'b'], 'a'],
    ['unknown previous selection → first', 'x', ['a'], ['a', 'b'], 'a'],
  ])('reconciles selection after refresh: %s', (_name, prev, prevOrder, next, expected) => {
    expect(reconcileSelection(prev, prevOrder, files(...next))).toBe(expected)
  })

  it.each([
    ['src/app.ts', ['src/app.ts'], 'branch', 'uncommitted'],
    ['docs/added.md', ['src/app.ts'], 'uncommitted', 'branch'],
    ['docs/added.md', null, 'uncommitted', 'uncommitted'],
  ] as const)('revealMode(%s)', (path, uncommitted, current, expected) => {
    expect(revealMode(path, uncommitted, current)).toBe(expected)
  })
})

describe('git-changes store', () => {
  it('reconcile remembers the order and moves the selection', () => {
    const s = useGitChangesStore.getState()
    s.reconcile('w', files('a', 'b', 'c'))
    expect(view().selectedPath).toBe('a')
    s.select('w', 'b')
    s.reconcile('w', files('a', 'c'))
    expect(view()).toMatchObject({ selectedPath: 'c', order: ['a', 'c'] })
  })

  it('reveal switches mode and selects; the composer closes on selection change', () => {
    const s = useGitChangesStore.getState()
    s.openComposer('w', { source: 'diff', filePath: 'a' })
    s.reveal('w', 'docs/added.md', ['src/app.ts'])
    expect(view()).toMatchObject({ mode: 'branch', selectedPath: 'docs/added.md', composer: null })
    s.setMode('w', 'uncommitted')
    expect(view().mode).toBe('uncommitted')
  })

  it('reveal with a focus keeps it (new seq each time) until cleared', () => {
    const s = useGitChangesStore.getState()
    s.reveal('w', 'src/app.ts', ['src/app.ts'], { line: 10, side: 'new', commentId: 'c1' })
    const first = view().focus
    expect(first).toMatchObject({ line: 10, side: 'new', commentId: 'c1' })
    s.reveal('w', 'src/app.ts', ['src/app.ts'], { line: 10 })
    expect(view().focus?.seq).toBeGreaterThan(first?.seq ?? Number.POSITIVE_INFINITY)
    s.clearFocus('w')
    expect(view().focus).toBeNull()
    s.reveal('w', 'src/app.ts', ['src/app.ts'])
    expect(view().focus).toBeNull()
  })

  it('the file filter is kept per worktree, across mode switches', () => {
    const s = useGitChangesStore.getState()
    s.setFilter('w', 'ödeme')
    s.setMode('w', 'branch')
    expect(view().filter).toBe('ödeme')
    expect(viewOf(useGitChangesStore.getState(), 'other').filter).toBe('')
  })
})
