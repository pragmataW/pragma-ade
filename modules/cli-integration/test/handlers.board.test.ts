import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { aTask, context, fakeBoard, makeDeps, REVIEW_DESCRIPTION } from './support/fakes'

const ctx = context({ worktreeId: 'w1' })
const setup = (tasks = [aTask(42, { columnId: 2, labelIds: [1] }), aTask(7, { columnId: 4 })]) => {
  const board = fakeBoard(tasks)
  return { board, h: createCliHandlers(makeDeps({ board })) }
}

describe('taskColumns', () => {
  it('lists the columns in board order with description and task count, read live', async () => {
    const { board, h } = setup()
    expect(await h.taskColumns({ context: ctx })).toEqual({
      ok: true,
      result: {
        projectId: 'p1',
        columns: [
          { id: 1, name: 'Backlog', description: '', taskCount: 0 },
          { id: 2, name: 'Todo', description: '', taskCount: 1 },
          { id: 3, name: 'In Progress', description: '', taskCount: 0 },
          { id: 4, name: 'Review', description: REVIEW_DESCRIPTION, taskCount: 1 },
          { id: 5, name: 'Done', description: '', taskCount: 0 },
        ],
      },
    })
    expect(board.state.calls).toContainEqual(['listTasks', { projectId: 'p1' }])
  })

  it('an unknown --project → not_found', async () => {
    const { h } = setup()
    expect(await h.taskColumns({ context: ctx, projectId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    })
  })

  it('board missing → module_unavailable', async () => {
    const h = createCliHandlers(makeDeps({ board: undefined }))
    expect(await h.taskColumns({ context: ctx })).toMatchObject({ ok: false, error: { code: 'module_unavailable' } })
  })
})
