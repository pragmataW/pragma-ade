import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { findTasksForSession } from '../src/main/handlers/task'
import { aTask, context, fakeBoard, makeDeps } from './support/fakes'

const ctx = context({ worktreeId: 'w1' })
const setup = (tasks = [aTask(42, { columnId: 2, labelIds: [1] }), aTask(7, { columnId: 4 })]) => {
  const board = fakeBoard(tasks)
  return { board, h: createCliHandlers(makeDeps({ board })) }
}

describe('task handlers', () => {
  it('taskList filters by resolved project and column (case-insensitive)', async () => {
    const { board, h } = setup()
    expect(await h.taskList?.({ context: ctx, column: 'review' })).toMatchObject({
      ok: true,
      result: { projectId: 'p1', tasks: [{ id: 7, column: 'Review' }] },
    })
    expect(board.state.calls).toContainEqual(['listTasks', { projectId: 'p1', column: 4 }])
  })

  it('taskList maps column and label names', async () => {
    const { h } = setup()
    expect(await h.taskList?.({ context: ctx })).toMatchObject({
      ok: true,
      result: { tasks: [{ id: 42, key: 'P1-42', column: 'Todo', labels: ['ui'] }, { id: 7 }] },
    })
  })

  it('taskCreate passes title/descriptionMd/priority/labels and returns a numeric id', async () => {
    const { board, h } = setup()
    const req = { context: ctx, title: 'From CLI', description: 'Body', priority: 'high', labels: ['ui'] } as const
    const res = await h.taskCreate?.(req)
    expect(board.state.calls).toContainEqual([
      'createTask',
      { projectId: 'p1', title: 'From CLI', descriptionMd: 'Body', priority: 'high', labels: ['ui'] },
    ])
    expect(res).toMatchObject({ ok: true, result: { id: expect.any(Number), title: 'From CLI', column: 'Backlog' } })
  })

  it('taskUpdate only sends provided fields (description → descriptionMd)', async () => {
    const { board, h } = setup()
    await h.taskUpdate?.({ context: ctx, taskId: '42', description: 'New' })
    expect(board.state.calls).toContainEqual(['updateTask', 42, { descriptionMd: 'New' }])
  })

  it('task ref "42" resolves via getTask and "review" resolves to column Review', async () => {
    const { board, h } = setup()
    expect(await h.taskMove?.({ context: ctx, taskId: '42', column: 'review' })).toMatchObject({
      ok: true,
      result: { id: 42, column: 'Review' },
    })
    expect(board.state.calls).toContainEqual(['moveTask', 42, 4])
  })

  it('a task key works as a ref', async () => {
    const { h } = setup()
    expect(await h.taskMove?.({ context: ctx, taskId: 'P1-7', column: 'Done' })).toMatchObject({
      ok: true,
      result: { id: 7, column: 'Done' },
    })
  })

  it('unknown ref → not_found', async () => {
    const { h } = setup()
    expect(await h.taskMove?.({ context: ctx, taskId: '999', column: 'Done' })).toMatchObject({
      ok: false,
      error: { code: 'not_found', message: "Task '999' not found." },
    })
  })

  it('unknown column → not_found with the column names in the message', async () => {
    const { h } = setup()
    const res = await h.taskMove?.({ context: ctx, taskId: '42', column: 'Nope' })
    expect(res).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(JSON.stringify(res)).toContain('Backlog, Todo, In Progress, Review, Done')
  })

  it.each([
    ['taskList', { context: ctx }],
    ['taskCreate', { context: ctx, title: 't' }],
    ['taskUpdate', { context: ctx, taskId: '1', title: 't' }],
    ['taskMove', { context: ctx, taskId: '1', column: 'Done' }],
  ] as const)('board missing → module_unavailable for %s', async (method, req) => {
    const h = createCliHandlers(makeDeps({ board: undefined }))
    expect(await h[method]?.(req)).toMatchObject({ ok: false, error: { code: 'module_unavailable' } })
  })

  it('findTasksForSession calls listTasks({ sessionId })', async () => {
    const board = fakeBoard([aTask(9, { sessionIds: ['s0'] }), aTask(10)])
    expect((await findTasksForSession(board, 's0')).map((t) => t.id)).toEqual([9])
    expect(board.state.calls).toContainEqual(['listTasks', { sessionId: 's0' }])
  })
})
