import { beforeEach, describe, expect, it } from 'vitest'
import { BoardError, DEFAULT_COLUMN_NAMES, type TaskDto } from '../src/contract'
import { aProject, aWorktree, makeService, type ServiceHarness } from './support/fakes'

let h: ServiceHarness
beforeEach(async () => {
  h = await makeService({
    projects: {
      projects: [aProject('p1', 'pragma-ade'), aProject('p2', 'other', 1)],
      worktrees: [aWorktree('w1', 'p1'), aWorktree('w2', 'p2')],
    },
  })
})

const create = (title: string, extra: Partial<Parameters<ServiceHarness['service']['createTask']>[0]> = {}) =>
  h.service.createTask({ projectId: 'p1', title, ...extra })
const columnName = async (t: TaskDto) =>
  (await h.service.getBoard(t.projectId)).columns.find((c) => c.id === t.columnId)?.name

describe('boards', () => {
  it('getBoard creates default columns once', async () => {
    const first = await h.service.getBoard('p1')
    expect(first.columns.map((c) => c.name)).toEqual([...DEFAULT_COLUMN_NAMES])
    const second = await h.service.getBoard('p1')
    expect(second.columns.map((c) => c.id)).toEqual(first.columns.map((c) => c.id))
    expect(first.board.keyPrefix).toBe('PRA')
  })

  it('gives a second project with the same prefix a unique one', async () => {
    h.projects.state.projects.push(aProject('p3', 'pragmatic', 2))
    await h.service.getBoard('p1')
    expect((await h.service.getBoard('p3')).board.keyPrefix).toBe('PRA2')
  })

  it('unknown project throws not_found', async () => {
    await expect(h.service.getBoard('nope')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('createTask', () => {
  it('defaults to the first column at the end', async () => {
    const a = await create('A')
    const b = await create('B')
    expect([a.key, b.key]).toEqual(['PRA-1', 'PRA-2'])
    expect(await columnName(a)).toBe('Backlog')
    expect(b.sortKey > a.sortKey).toBe(true)
  })

  it('accepts a column name case-insensitively', async () => {
    expect(await columnName(await create('A', { column: 'in progress' }))).toBe('In Progress')
  })

  it('creates one label for bug/Bug and advances colours, skipping gray', async () => {
    const t = await create('A', { labels: ['bug', 'Bug'] })
    expect(t.labelIds).toHaveLength(1)
    await create('B', { labels: ['feature'] })
    expect((await h.service.getBoard('p1')).labels.map((l) => [l.name, l.color])).toEqual([
      ['bug', 'red'],
      ['feature', 'orange'],
    ])
  })
})

describe('updateTask', () => {
  it('edits title, description, priority and labels; updatedAt increases', async () => {
    const t = await create('A')
    const u = await h.service.updateTask(t.id, {
      title: 'B',
      descriptionMd: '**x**',
      priority: 'high',
      labels: ['bug'],
    })
    expect(u).toMatchObject({ title: 'B', descriptionMd: '**x**', priority: 'high' })
    expect(u.labelIds).toHaveLength(1)
    expect(u.updatedAt).toBeGreaterThan(t.updatedAt)
  })

  it('rejects a worktree of another project', async () => {
    const t = await create('A')
    const err = await h.service.updateTask(t.id, { worktreeId: 'w2' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BoardError)
    expect(err).toMatchObject({ code: 'validation' })
    expect((await h.service.updateTask(t.id, { worktreeId: 'w1' })).worktreeId).toBe('w1')
  })

  it('rejects a label id of another board', async () => {
    const other = await h.service.createLabel('p2', 'x')
    await expect(create('A', { labels: [other.id] })).rejects.toMatchObject({ code: 'validation' })
  })
})

it('deleteTask removes the task and its session links', async () => {
  const t = await create('A')
  h.repo.insertSessionLink(t.id, 's1', 1)
  await h.service.deleteTask(t.id)
  expect(await h.service.getTask(t.id)).toBeNull()
  expect(h.repo.listTaskIdsForSession('s1')).toEqual([])
})

it('deleteLabel strips the id from tasks', async () => {
  const t = await create('A', { labels: ['bug', 'ui'] })
  const [bug] = (await h.service.getBoard('p1')).labels
  await h.service.deleteLabel(bug?.id as number)
  expect((await h.service.getTask(t.id))?.labelIds).toHaveLength(1)
})

it.each([1, '1', 'pra-1', 'PRA-1'])('getTask resolves %j', async (ref) => {
  const t = await create('A')
  expect((await h.service.getTask(ref))?.id).toBe(t.id)
})

it('getTask returns null for unknown refs', async () => {
  await create('A')
  expect(await h.service.getTask('XYZ-1')).toBeNull()
  expect(await h.service.getTask('garbage')).toBeNull()
})

describe('listTasks', () => {
  it('filters by project and column name in order', async () => {
    const a = await create('A')
    await create('T', { column: 'Todo' })
    const b = await create('B')
    const listed = await h.service.listTasks({ projectId: 'p1', column: 'Backlog' })
    expect(listed.map((t) => t.id)).toEqual([a.id, b.id])
  })
  it('unknown column → []', async () => {
    await create('A')
    expect(await h.service.listTasks({ column: 'Nope' })).toEqual([])
  })
  it('labels and query', async () => {
    await create('fix login', { labels: ['bug'] })
    await create('other')
    expect((await h.service.listTasks({ labels: ['BUG'] })).map((t) => t.title)).toEqual(['fix login'])
    expect((await h.service.listTasks({ query: 'LOGIN' })).map((t) => t.title)).toEqual(['fix login'])
    expect(await h.service.listTasks({ labels: ['none-such'] })).toEqual([])
  })
})

it('snapshot all-projects skips boards of removed projects', async () => {
  await create('A')
  await h.service.createTask({ projectId: 'p2', title: 'B' })
  h.projects.state.projects = h.projects.state.projects.filter((p) => p.id === 'p1')
  const snap = await h.service.getSnapshot({ kind: 'all' })
  expect(snap.sections.map((s) => s.projectName)).toEqual(['pragma-ade'])
  expect(snap.tasks.map((t) => t.title)).toEqual(['A'])
  expect(snap.statusAvailable).toBe(true)
})

it('each mutation emits board.changed once with projectId', async () => {
  const t = await create('A')
  await h.service.updateTask(t.id, { title: 'B' })
  const label = await h.service.createLabel('p1', 'x')
  await h.service.updateLabel(label.id, { color: 'blue' })
  await h.service.deleteLabel(label.id)
  await h.service.deleteTask(t.id)
  expect(h.emitted.map((e) => [e.projectId, e.kind])).toEqual([
    ['p1', 'task'],
    ['p1', 'task'],
    ['p1', 'label'],
    ['p1', 'label'],
    ['p1', 'label'],
    ['p1', 'task'],
  ])
})
