import { expect, test } from 'vitest'
import { type LayoutNode, TerminalTabSchema } from '../src/contract'
import { leafIds, neighbourPane, paneLeaf, removePane, splitPane } from '../src/lib/layout-tree'
import { pane } from './support/factories'

const row = (...children: LayoutNode[]): LayoutNode => ({ kind: 'split', direction: 'vertical', children })
const col = (...children: LayoutNode[]): LayoutNode => ({ kind: 'split', direction: 'horizontal', children })
const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(paneLeaf) as [LayoutNode, LayoutNode, LayoutNode, LayoutNode]

test.each([
  ['a leaf becomes a split of two', a, 'a', 'vertical', row(a, b)],
  ['along the same row the new pane is a sibling after the target', row(a, c), 'a', 'vertical', row(a, b, c)],
  ['across a row the target becomes a nested column', row(a, c), 'c', 'horizontal', row(a, col(c, b))],
  ['nested targets are found', row(a, col(c, d)), 'd', 'vertical', row(a, col(c, row(d, b)))],
  ['an unknown target leaves the tree unchanged', row(a, c), 'zz', 'vertical', row(a, c)],
] as const)('splitPane: %s', (_name, root, target, direction, expected) => {
  expect(splitPane(root, target, 'b', direction)).toEqual(expected)
})

test('splitPane keeps the same tree object for an unknown target', () => {
  const root = row(a, col(c, d))
  expect(splitPane(root, 'zz', 'b', 'vertical')).toBe(root)
})

test.each([
  ['the last pane leaves nothing', a, 'a', null],
  ['a split of two collapses into the survivor', row(a, b), 'a', b],
  ['a split of three keeps the other two', row(a, b, c), 'b', row(a, c)],
  ['a collapsed column merges into its parent row', row(a, col(b, c)), 'c', row(a, b)],
  ['a collapsed row inside a column inside a row is flattened', row(d, col(row(a, b), c)), 'c', row(d, a, b)],
  ['an unknown pane leaves the tree unchanged', row(a, b), 'zz', row(a, b)],
] as const)('removePane: %s', (_name, root, paneId, expected) => {
  expect(removePane(root, paneId)).toEqual(expected)
})

test('leafIds and neighbourPane follow reading order', () => {
  const root = row(a, col(b, c), d)
  expect(leafIds(root)).toEqual(['a', 'b', 'c', 'd'])
  expect(neighbourPane(root, 'b')).toBe('c')
  expect(neighbourPane(root, 'd')).toBe('c')
  expect(neighbourPane(a, 'a')).toBeNull()
  expect(neighbourPane(root, 'zz')).toBeNull()
})

const legacy = (split: string, count: number) => {
  const panes = Array.from({ length: count }, () => pane())
  return { panes, raw: { id: 't', ordinal: 1, customTitle: null, split, panes, activePaneId: panes[0]?.id } }
}

test.each([
  ['none', 1],
  ['vertical', 1],
])('a legacy %s tab with %i pane migrates to a single leaf', (split, count) => {
  const { panes, raw } = legacy(split, count)
  const parsed = TerminalTabSchema.parse(raw)
  expect(parsed.root).toEqual(paneLeaf(panes[0]?.id ?? ''))
  expect(parsed).not.toHaveProperty('split')
})

test.each(['vertical', 'horizontal'] as const)('a legacy %s split migrates to a split node', (direction) => {
  const { panes, raw } = legacy(direction, 2)
  expect(TerminalTabSchema.parse(raw).root).toEqual({
    kind: 'split',
    direction,
    children: panes.map((p) => paneLeaf(p.id)),
  })
})

test('a tab with neither root nor a legacy split is rejected', () => {
  const { raw } = legacy('diagonal', 1)
  expect(TerminalTabSchema.safeParse(raw).success).toBe(false)
})
