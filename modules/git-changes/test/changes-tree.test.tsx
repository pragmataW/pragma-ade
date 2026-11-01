import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChangedFile } from '../src/contract'
import { buildFlatList, buildTree } from '../src/renderer/tree/build-tree'
import { ChangesTree } from '../src/renderer/tree/ChangesTree'
import { STANDARD_EXPECT } from '../testing'
import { renderWithStrings } from './helpers/i18n'

const STATUS: Record<string, ChangedFile['status']> = {
  'docs/added.md': 'A',
  'long.ts': 'M',
  'new-name.txt': 'R',
  'remove-me.txt': 'D',
  'src/main/git/service.ts': 'M',
}
const FILES: ChangedFile[] = STANDARD_EXPECT.branchVsMain.map((path) => ({
  path,
  status: STATUS[path] ?? 'M',
  additions: 1,
  deletions: 0,
  binary: false,
  ...(path === 'new-name.txt' ? { oldPath: 'old-name.txt' } : {}),
}))
const row = (path: string) => document.querySelector(`[data-testid="gc-tree-row"][data-path="${path}"]`) as HTMLElement

function renderTree(nodes = buildTree(FILES), counts: Record<string, number> = {}) {
  const onSelect = vi.fn()
  renderWithStrings(<ChangesTree nodes={nodes} selectedPath={null} onSelect={onSelect} commentCounts={counts} />)
  return onSelect
}

describe('ChangesTree', () => {
  it('rows carry their depth: docs 0, added.md 1', () => {
    renderTree()
    expect(row('docs')).toHaveAttribute('data-depth', '0')
    expect(row('docs/added.md')).toHaveAttribute('data-depth', '1')
    expect(row('src/main/git')).toHaveTextContent('src/main/git')
  })

  it.each([
    ['docs/added.md', 'A'],
    ['new-name.txt', 'R'],
    ['remove-me.txt', 'D'],
    ['long.ts', 'M'],
  ])('%s shows status letter %s', (path, letter) => {
    renderTree()
    const status = row(path).querySelector(`.gc-status-${letter}`)
    expect(status).toHaveTextContent(letter)
  })

  it('a deleted file name is struck through', () => {
    renderTree()
    expect(getComputedStyle(screen.getByText('remove-me.txt')).textDecorationLine).toBe('line-through')
  })

  it('a renamed file has old → new as title', () => {
    renderTree()
    expect(row('new-name.txt')).toHaveAttribute('title', 'old-name.txt → new-name.txt')
  })

  it('clicking added.md selects docs/added.md', () => {
    const onSelect = renderTree()
    fireEvent.click(screen.getByText('added.md'))
    expect(onSelect).toHaveBeenCalledWith('docs/added.md')
  })

  it('list mode renders 5 rows at depth 0', () => {
    renderTree(buildFlatList(FILES))
    const rows = screen.getAllByTestId('gc-tree-row')
    expect(rows.map((r) => r.getAttribute('data-depth'))).toEqual(['0', '0', '0', '0', '0'])
  })

  it('a file with draft comments shows the count', () => {
    renderTree(buildTree(FILES), { 'long.ts': 2 })
    expect(row('long.ts')).toHaveTextContent('long.ts2M')
  })
})
