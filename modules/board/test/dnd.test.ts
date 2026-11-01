import { describe, expect, it } from 'vitest'
import { cardDrop, columnDndId, columnDrop, taskDndId } from '../src/renderer/lib/dnd'
import { groupTasks } from '../src/renderer/model'
import { aSection, aTask } from './support/builders'

const section = aSection(1, 'Alpha')
const [backlog, todo] = section.columns as [(typeof section.columns)[0], (typeof section.columns)[0]]
const tasks = [
  aTask({ id: 1, columnId: todo.id, sortKey: 'a0' }),
  aTask({ id: 2, columnId: todo.id, sortKey: 'a1' }),
  aTask({ id: 3, columnId: todo.id, sortKey: 'a2' }),
]
const layout = { columns: section.columns, grouped: groupTasks({ tasks }, section.columns, {}) }
const ev = (active: string, over: string | null) =>
  ({ active: { id: active }, over: over ? { id: over } : null }) as never

describe('cardDrop', () => {
  it.each([
    ['moving up lands before the card', 3, 1, { beforeTaskId: 1 }],
    ['moving down lands after the card', 1, 3, { afterTaskId: 3 }],
  ])('%s', (_n, from, over, position) => {
    expect(cardDrop(layout, ev(taskDndId(from), taskDndId(over)))?.drop).toEqual({
      ok: true,
      column: todo.id,
      position,
    })
  })
  it('dropping on a column appends', () => {
    expect(cardDrop(layout, ev(taskDndId(1), columnDndId(backlog)))?.drop).toEqual({
      ok: true,
      column: backlog.id,
      position: {},
    })
  })
  it('dropping on itself or nowhere does nothing', () => {
    expect(cardDrop(layout, ev(taskDndId(1), taskDndId(1)))).toBeNull()
    expect(cardDrop(layout, ev(taskDndId(1), null))).toBeNull()
  })
})

describe('columnDrop', () => {
  it.each([
    [4, 1, { beforeColumnId: 11 }],
    [0, 2, { afterColumnId: 12 }],
  ])('column %i onto %i', (from, to, position) => {
    const cols = section.columns
    expect(columnDrop(cols, ev(columnDndId(cols[from] as never), columnDndId(cols[to] as never)))).toEqual({
      columnId: cols[from]?.id,
      position,
    })
  })
})
