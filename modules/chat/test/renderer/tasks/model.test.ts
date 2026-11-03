import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../../../src/contract'
import {
  findTask,
  taskCounts,
  taskElapsedMs,
  taskForest,
  taskGroupOf,
  taskPath,
  taskPrompt,
  taskResult,
  taskSections,
} from '../../../src/renderer/kit/tasks/model'
import { makeTranscript, TEST_AT } from '../../../testing'
import { task } from '../parts/samples'
import { TASKS_SCENARIO } from './fixture'

const t = makeTranscript(TASKS_SCENARIO)
const forest = taskForest(t)
const rowsOf = (sections: ReturnType<typeof taskSections>) =>
  sections.map((s) => [s.group, s.rows.map((r) => `${'  '.repeat(r.depth)}${r.task.id}${r.context ? '*' : ''}`)])

describe('tasks panel model', () => {
  it.each([
    ['running', 'running'],
    ['pending', 'waiting'],
    ['paused', 'waiting'],
    ['completed', 'finished'],
    ['failed', 'finished'],
    ['killed', 'finished'],
  ] as const)('%s tasks are in the %s group', (status, group) => {
    expect(taskGroupOf(status)).toBe(group)
  })

  it('nests tasks by parent task id and by the parent tool call id (roots in arrival order)', () => {
    const shape = (nodes: typeof forest): unknown[] => nodes.map((n) => [n.task.id, shape(n.children)])
    expect(shape(forest)).toEqual([
      [
        'wf',
        [
          ['t1', []],
          ['t2', [['t3', []]]],
        ],
      ],
      ['t4', []],
      ['t5', []],
    ])
  })

  it('counts every task by group, with failures and workflows apart', () => {
    expect(taskCounts(t)).toEqual({ total: 6, running: 3, waiting: 1, done: 1, failed: 1, workflows: 1 })
  })

  it('sections group the trees by their root (Running / Waiting / Finished), children indented', () => {
    expect(rowsOf(taskSections(forest, 'all', ''))).toEqual([
      ['running', ['wf', '  t1', '  t2', '    t3']],
      ['waiting', ['t4']],
      ['finished', ['t5']],
    ])
  })

  it.each([
    [
      'running',
      '',
      [
        ['running', ['wf', '  t2', '    t3']],
        ['waiting', ['t4']],
      ],
    ],
    ['workflows', '', [['running', ['wf']]]],
    [
      'subagents',
      '',
      [
        ['running', ['wf*', '  t1', '  t2', '    t3']],
        ['waiting', ['t4']],
      ],
    ],
    ['all', 'GREP', [['running', ['wf*', '  t2*', '    t3']]]],
    ['all', 'diff', [['waiting', ['t4']]]],
    ['all', 'nothing like it', []],
  ] as const)('filter %s, search "%s": matches plus their ancestors as context (*)', (filter, query, expected) => {
    expect(rowsOf(taskSections(forest, filter, query))).toEqual(expected)
  })

  it('the path of a task runs from its root to itself', () => {
    expect(taskPath(t, 't3')).toEqual(['wf', 't2', 't3'])
    expect(taskPath(t, 'gone')).toEqual([])
  })

  it('prompt and result come from the spawning tool call', () => {
    const t1 = findTask(t, 't1') as TaskItem
    expect(taskPrompt(t, t1)).toBe('Find the loader')
    expect(taskResult(t, t1)).toBe('final report: config.ts')
    expect(taskPrompt(t, findTask(t, 'wf') as TaskItem)).toBeUndefined()
  })

  it('elapsed: live tasks tick from their start; finished ones use the reported duration, else start → end', () => {
    const live = { ...(findTask(t, 't2') as TaskItem), startedAt: TEST_AT }
    expect(taskElapsedMs(live, TEST_AT + 5000)).toBe(5000)
    const done = makeTranscript([task(), task({ status: 'completed', usage: { tokens: 1, durationMs: 42_000 } })])
    expect(taskElapsedMs(findTask(done, 'task1') as TaskItem, 0)).toBe(42_000)
    const timed = makeTranscript([task(), task({ usage: undefined }), task({ status: 'completed', usage: undefined })])
    expect(taskElapsedMs({ ...(findTask(timed, 'task1') as TaskItem), usage: undefined }, 0)).toBe(2)
    expect(taskElapsedMs({ ...live, status: 'completed', endedAt: TEST_AT, usage: undefined }, 0)).toBeUndefined()
  })
})
