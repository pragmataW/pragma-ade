import { expect, it } from 'vitest'
import { mergeColumns } from '../src/lib/merge-columns'
import { aSection } from './support/builders'

it('two default boards give five merged columns with both ids', () => {
  const merged = mergeColumns([aSection(1, 'A'), aSection(2, 'B')])
  expect(merged.map((m) => m.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'Review', 'Done'])
  expect(merged[1]?.columnIdByBoard).toEqual({ 1: 11, 2: 21 })
})

it('an extra column lands after its board neighbour', () => {
  const merged = mergeColumns([
    aSection(1, 'A'),
    aSection(2, 'B', ['Backlog', 'Todo', 'In Progress', 'Review', 'QA', 'Done']),
  ])
  expect(merged.map((m) => m.name)).toEqual(['Backlog', 'Todo', 'In Progress', 'Review', 'QA', 'Done'])
})

it('names merge case-insensitively, keeping the first spelling', () => {
  const merged = mergeColumns([aSection(1, 'A', ['Todo']), aSection(2, 'B', ['todo ', 'Later'])])
  expect(merged).toEqual([
    { key: 'todo', name: 'Todo', columnIdByBoard: { 1: 10, 2: 20 } },
    { key: 'later', name: 'Later', columnIdByBoard: { 2: 21 } },
  ])
})
