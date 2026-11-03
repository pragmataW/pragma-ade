import { beforeEach, describe, expect, it } from 'vitest'
import { type ColumnDto, LIMITS } from '../src/contract'
import { makeService, type ServiceHarness } from './support/fakes'

let h: ServiceHarness
beforeEach(async () => {
  h = await makeService()
})

const col = async (name: string, projectId = 'p1'): Promise<ColumnDto> => {
  const c = (await h.service.getBoard(projectId)).columns.find((x) => x.name === name)
  if (!c) throw new Error(`no column ${name}`)
  return c
}
const titles = async (column: string, svc = h.service) =>
  (await svc.listTasks({ projectId: 'p1', column })).map((t) => t.title)
const names = async () => (await h.service.getBoard('p1')).columns.map((c) => c.name)
/** Creates tasks in `column` in the given order; returns them by title. */
async function seed(column: string, ...ts: string[]) {
  const out: Record<string, number> = {}
  for (const title of ts) out[title] = (await h.service.createTask({ projectId: 'p1', title, column })).id
  return out
}

describe('moveTask', () => {
  it('appends to the end of another column by default', async () => {
    const { A } = await seed('Todo', 'A')
    await seed('Review', 'R1')
    await h.service.moveTask(A as number, 'Review')
    expect(await titles('Review')).toEqual(['R1', 'A'])
  })

  it('places after a task within the column', async () => {
    const { A, C } = await seed('Todo', 'A', 'B', 'C')
    await h.service.moveTask(C as number, 'Todo', { afterTaskId: A })
    expect(await titles('Todo')).toEqual(['A', 'C', 'B'])
  })

  it('places before the first task', async () => {
    const { A, C } = await seed('Todo', 'A', 'B', 'C')
    await h.service.moveTask(C as number, 'Todo', { beforeTaskId: A })
    expect(await titles('Todo')).toEqual(['C', 'A', 'B'])
  })

  it('places after the visible neighbour when a hidden card sits between', async () => {
    const { A } = await seed('Todo', 'A', 'H', 'B')
    const { X } = await seed('Backlog', 'X')
    await h.service.moveTask(X as number, 'Todo', { afterTaskId: A })
    expect(await titles('Todo')).toEqual(['A', 'X', 'H', 'B'])
    const keys = (await h.service.listTasks({ projectId: 'p1', column: 'Todo' })).map((t) => t.sortKey)
    expect(new Set(keys).size).toBe(4)
  })

  it('resolves column names case-insensitively within the task board', async () => {
    const t = await h.service.createTask({ projectId: 'p1', title: 'A' })
    await h.service.getBoard('p2')
    const moved = await h.service.moveTask(t.id, 'review')
    expect(moved.columnId).toBe((await col('Review')).id)
  })

  it("rejects another board's column id", async () => {
    const t = await h.service.createTask({ projectId: 'p1', title: 'A' })
    const other = await col('Review', 'p2')
    await expect(h.service.moveTask(t.id, other.id)).rejects.toMatchObject({ code: 'invalid_target_column' })
    await expect(h.service.moveTask(t.id, 'Nope')).rejects.toMatchObject({ code: 'column_not_found' })
  })

  it('ignores a deleted neighbour id', async () => {
    const { A, B } = await seed('Todo', 'A', 'B')
    const { X } = await seed('Backlog', 'X')
    await h.service.deleteTask(A as number)
    await h.service.moveTask(X as number, 'Todo', { afterTaskId: A, beforeTaskId: B })
    expect(await titles('Todo')).toEqual(['X', 'B'])
  })

  it('order survives a fresh service over the same DB file', async () => {
    const { A, C } = await seed('Todo', 'A', 'B', 'C')
    await h.service.moveTask(C as number, 'Todo', { afterTaskId: A })
    const fresh = await h.restart()
    expect(await titles('Todo', fresh)).toEqual(['A', 'C', 'B'])
  })
})

describe('columns', () => {
  it('createColumn after Todo', async () => {
    await h.service.createColumn('p1', 'QA', { afterColumnId: (await col('Todo')).id })
    expect(await names()).toEqual(['Backlog', 'Todo', 'QA', 'In Progress', 'Review', 'Done'])
  })

  it('renameColumn to an existing name throws duplicate_column_name', async () => {
    await expect(h.service.renameColumn((await col('Todo')).id, 'backlog')).rejects.toMatchObject({
      code: 'duplicate_column_name',
    })
    await expect(h.service.createColumn('p1', ' DONE ')).rejects.toMatchObject({ code: 'duplicate_column_name' })
    await h.service.renameColumn((await col('Todo')).id, 'To do')
    expect((await names())[1]).toBe('To do')
  })

  it('moveColumn before Backlog makes it first', async () => {
    await h.service.moveColumn((await col('Done')).id, { beforeColumnId: (await col('Backlog')).id })
    expect((await names())[0]).toBe('Done')
  })

  it('deleteColumn with tasks requires moveTasksTo', async () => {
    await seed('Review', 'X')
    await expect(h.service.deleteColumn((await col('Review')).id)).rejects.toMatchObject({ code: 'validation' })
  })

  it('deleteColumn moves tasks after the target tasks in order', async () => {
    await seed('Review', 'X', 'Y')
    await seed('Done', 'Z')
    await h.service.deleteColumn((await col('Review')).id, { moveTasksTo: (await col('Done')).id })
    expect(await titles('Done')).toEqual(['Z', 'X', 'Y'])
    expect(await names()).not.toContain('Review')
  })

  it('deleteColumn of an empty column needs no target', async () => {
    await h.service.deleteColumn((await col('Review')).id)
    expect(await names()).toEqual(['Backlog', 'Todo', 'In Progress', 'Done'])
  })

  it('deleteColumn refuses the last column', async () => {
    for (const name of ['Backlog', 'Todo', 'In Progress', 'Review']) await h.service.deleteColumn((await col(name)).id)
    await expect(h.service.deleteColumn((await col('Done')).id)).rejects.toMatchObject({ code: 'last_column' })
  })

  it('setColumnDescription stores trimmed text, survives restart, and "" clears it', async () => {
    const review = await col('Review')
    expect((await h.service.setColumnDescription(review.id, '  Needs my review  ')).description).toBe('Needs my review')
    await h.restart()
    expect((await col('Review')).description).toBe('Needs my review')
    await h.service.setColumnDescription(review.id, '')
    expect((await col('Review')).description).toBe('')
  })

  it('setColumnDescription over the limit throws and keeps the stored text', async () => {
    const review = await col('Review')
    await h.service.setColumnDescription(review.id, 'kept')
    await expect(
      h.service.setColumnDescription(review.id, 'x'.repeat(LIMITS.columnDescriptionMax + 1)),
    ).rejects.toBeTruthy()
    expect((await col('Review')).description).toBe('kept')
  })

  it('setColumnDescription on an unknown column throws column_not_found', async () => {
    await expect(h.service.setColumnDescription(9999, 'x')).rejects.toMatchObject({ code: 'column_not_found' })
  })

  it('setColumnDescription emits board.changed once', async () => {
    const review = await col('Review')
    h.emitted.length = 0
    await h.service.setColumnDescription(review.id, 'x')
    expect(h.emitted.map((e) => [e.projectId, e.kind])).toEqual([['p1', 'column']])
  })
})
