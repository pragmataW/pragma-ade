import { describe, expect, it } from 'vitest'
import { mergeColumns } from '../src/lib/merge-columns'
import {
  agentFilterOptions,
  buildPredicate,
  EMPTY_FILTER,
  groupTasks,
  isFilterActive,
  openCount,
  resolveDrop,
} from '../src/renderer/model'
import { aLinkedSession, aSection, aTask } from './support/builders'

const p1 = aSection(1, 'Alpha', undefined, ['bug', 'ui'])
const p2 = aSection(2, 'Beta', undefined, ['Bug'])

describe('buildPredicate', () => {
  it('resolves label names across sections', () => {
    expect(buildPredicate({ ...EMPTY_FILTER, labelNames: ['bug'] }, [p1, p2]).labelIds).toEqual([110, 120])
  })
  it.each([
    ['with', true],
    ['without', false],
    ['any', undefined],
  ] as const)('worktree %s', (worktree, hasWorktree) => {
    expect(buildPredicate({ ...EMPTY_FILTER, worktree }, []).hasWorktree).toBe(hasWorktree)
  })
  it('splits agents into profile ids and no-agent', () => {
    expect(buildPredicate({ ...EMPTY_FILTER, agents: ['fake', 'none'] }, [])).toMatchObject({
      agentProfileIds: ['fake'],
      includeNoAgent: true,
    })
  })
  it('isFilterActive', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive({ ...EMPTY_FILTER, query: 'x' })).toBe(true)
  })
})

describe('resolveDrop', () => {
  const column = p1.columns[1] as (typeof p1.columns)[number]
  const a = aTask({ id: 1 })
  const b = aTask({ id: 2 })
  const x = aTask({ id: 3 })
  it.each([
    [[a, b], 0, { beforeTaskId: 1 }],
    [[a, b], 2, { afterTaskId: 2 }],
    [[a, b], 1, { afterTaskId: 1 }],
    [[], 0, {}],
  ])('visible %#', (visibleTasks, index, position) => {
    expect(resolveDrop({ task: x, targetColumn: column, visibleTasks, index })).toEqual({
      ok: true,
      column: column.id,
      position,
    })
  })
  it('maps a merged column to the board of the task, or reports no_such_column', () => {
    const merged = mergeColumns([p1, aSection(2, 'Beta', ['Todo'])])
    const backlog = merged.find((m) => m.key === 'backlog')
    const todo = merged.find((m) => m.key === 'todo')
    const p2task = aTask({ id: 9, boardId: 2 })
    expect(resolveDrop({ task: p2task, targetColumn: todo as never, visibleTasks: [], index: 0 })).toMatchObject({
      ok: true,
      column: 20,
    })
    expect(resolveDrop({ task: p2task, targetColumn: backlog as never, visibleTasks: [], index: 0 })).toEqual({
      ok: false,
      reason: 'no_such_column',
    })
  })
})

describe('groupTasks', () => {
  it('groups by column in sort-key order and applies the predicate', () => {
    const todo = p1.columns[1]?.id as number
    const tasks = [
      aTask({ id: 1, columnId: todo, sortKey: 'a2' }),
      aTask({ id: 2, columnId: todo, sortKey: 'a1', priority: 'high' }),
      aTask({ id: 3, columnId: todo, sortKey: 'a0' }),
    ]
    const all = groupTasks({ tasks }, p1.columns, {})
    expect(all.get(String(todo))?.map((t) => t.id)).toEqual([3, 2, 1])
    expect(
      groupTasks({ tasks }, p1.columns, { priorities: ['high'] })
        .get(String(todo))
        ?.map((t) => t.id),
    ).toEqual([2])
  })
  it('groups merged columns across boards', () => {
    const merged = mergeColumns([p1, p2])
    const tasks = [aTask({ id: 1, columnId: 11 }), aTask({ id: 2, boardId: 2, columnId: 21, sortKey: 'b' })]
    expect(
      groupTasks({ tasks }, merged, {})
        .get('todo')
        ?.map((t) => t.id),
    ).toEqual([1, 2])
  })
})

it('openCount excludes the last column', () => {
  const tasks = [aTask({ id: 1, columnId: 10 }), aTask({ id: 2, columnId: 14 })]
  expect(openCount({ sections: [p1], tasks })).toBe(1)
})

it('agentFilterOptions lists distinct profiles by name', () => {
  const tasks = [
    aTask({ id: 1, sessions: [aLinkedSession('s1', { profileId: 'z', profileName: 'Zed agent' })] }),
    aTask({ id: 2, sessions: [aLinkedSession('s2'), aLinkedSession('s3')] }),
  ]
  expect(agentFilterOptions({ tasks }).map((o) => o.profileId)).toEqual(['fake', 'z'])
})
