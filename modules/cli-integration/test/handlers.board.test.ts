import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { aTask, aWorktree, context, fakeProjects, handlersOnBoard, makeDeps, REVIEW_DESCRIPTION } from './support/fakes'

const ctx = context({ worktreeId: 'w1' })
/** Todo holds 42 (label `ui`), Review holds 7. */
const setup = (tasks = [aTask(42, { columnId: 2, labelIds: [1] }), aTask(7, { columnId: 4 })]) => handlersOnBoard(tasks)

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

describe('taskShow', () => {
  const tasks = () => [
    aTask(42, { columnId: 2, labelIds: [1], descriptionMd: '# Goal\n- [ ] x' }),
    aTask(7, { columnId: 4, worktreeId: 'w2' }),
  ]

  it('prints the full task by id with its column and description', async () => {
    const { h } = setup(tasks())
    expect(await h.taskShow({ context: ctx, taskId: '42' })).toMatchObject({
      ok: true,
      result: {
        id: 42,
        key: 'P1-42',
        column: 'Todo',
        labels: ['ui'],
        description: '# Goal\n- [ ] x',
        columnDescription: '',
        worktreeBranch: null,
      },
    })
  })

  it('resolves a key and carries the column description and the worktree branch', async () => {
    const projects = fakeProjects({ worktrees: [aWorktree('w1'), aWorktree('w2', { branch: 'feat/p1-7' })] })
    const { h } = handlersOnBoard(tasks(), { projects })
    expect(await h.taskShow({ context: ctx, taskId: 'P1-7' })).toMatchObject({
      ok: true,
      result: {
        id: 7,
        column: 'Review',
        columnDescription: REVIEW_DESCRIPTION,
        worktreeId: 'w2',
        worktreeBranch: 'feat/p1-7',
      },
    })
  })

  it('unknown ref → not_found', async () => {
    const { h } = setup(tasks())
    expect(await h.taskShow({ context: ctx, taskId: '999' })).toMatchObject({
      ok: false,
      error: { code: 'not_found', message: "Task '999' not found." },
    })
  })

  it('board missing → module_unavailable', async () => {
    const h = createCliHandlers(makeDeps({ board: undefined }))
    expect(await h.taskShow({ context: ctx, taskId: '1' })).toMatchObject({
      ok: false,
      error: { code: 'module_unavailable' },
    })
  })
})
