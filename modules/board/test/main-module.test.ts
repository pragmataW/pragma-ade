import { agentSessionStatusChanged } from '@pragma/module-agent-status/contract'
import { projectRemoved, worktreeRemoved } from '@pragma/module-projects/contract'
import { describe, expect, it, vi } from 'vitest'
import { boardIpc, boardIpcEvents, SCOPE_KIND } from '../src/contract'
import { activateBoard } from './support/ctx'

const changedPushes = (a: Awaited<ReturnType<typeof activateBoard>>) => a.fake.publishedOn(boardIpcEvents.changed)
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  return r.value
}

describe('board main module', () => {
  it('provides BoardServiceToken', async () => {
    expect((await activateBoard()).service.listTasks).toBeTypeOf('function')
  })

  it('createTask via IPC returns a TaskDto and pushes board.changedEvent', async () => {
    const a = await activateBoard()
    const task = unwrap(await a.fake.invoke(boardIpc.createTask, { projectId: 'p1', title: 'A' }))
    expect(task.key).toBe('PRA-1')
    await vi.waitFor(() => expect(changedPushes(a)).toEqual([{ projectIds: ['p1'] }]))
  })

  it('expected failures cross IPC as BoardErrorDto', async () => {
    const a = await activateBoard()
    const r = await a.fake.invoke(boardIpc.getSnapshot, { scope: { kind: SCOPE_KIND.project, projectId: 'nope' } })
    expect(r).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })

  it('a service call from another module (no IPC) pushes board.changedEvent', async () => {
    const a = await activateBoard()
    await a.service.createTask({ projectId: 'p2', title: 'From CLI' })
    await vi.waitFor(() => expect(changedPushes(a)).toEqual([{ projectIds: ['p2'] }]))
  })

  it('worktree.removed clears the task worktree and pushes a change', async () => {
    const a = await activateBoard()
    const t = await a.service.createTask({ projectId: 'p1', title: 'A', worktreeId: 'w1' })
    await vi.waitFor(() => expect(changedPushes(a)).toHaveLength(1))
    a.fake.emit(worktreeRemoved, { worktreeId: 'w1', projectId: 'p1', path: '/wt/w1', reason: 'user' })
    expect((await a.service.getTask(t.id))?.worktreeId).toBeNull()
    await vi.waitFor(() => expect(changedPushes(a)).toHaveLength(2))
  })

  it('project.removed pushes a change', async () => {
    const a = await activateBoard()
    a.fake.emit(projectRemoved, { projectId: 'p2', repoPath: '/repos/p2' })
    await vi.waitFor(() => expect(changedPushes(a)).toEqual([{ projectIds: ['p2'] }]))
  })

  it('statusChanged pushes for linked sessions only', async () => {
    const a = await activateBoard({ withStatus: true })
    const t = await a.service.createTask({ projectId: 'p1', title: 'A' })
    await a.service.linkSession(t.id, 's9')
    a.status?.map.set('s9', { status: 'waiting', turnCompleted: false })
    a.fake.emit(agentSessionStatusChanged, { sessionId: 's9', status: 'waiting' })
    a.fake.emit(agentSessionStatusChanged, { sessionId: 'other', status: 'working' })
    expect(a.fake.publishedOn(boardIpcEvents.sessionStatusChanged)).toEqual([
      { sessionId: 's9', status: 'waiting', turnCompleted: false },
    ])
  })

  it('activates without agent-status', async () => {
    const a = await activateBoard()
    expect((await a.service.getSnapshot({ kind: SCOPE_KIND.all })).statusAvailable).toBe(false)
  })

  it.each([
    ['w2', { kind: 'project', projectId: 'p2' }],
    [null, { kind: 'project', projectId: 'p1' }],
  ])('resolveDefaultScope with active worktree %j', async (active, scope) => {
    const a = await activateBoard()
    a.projects.state.activeWorktreeId = active
    expect(unwrap(await a.fake.invoke(boardIpc.resolveDefaultScope, {}))).toEqual(scope)
  })

  it('resolveDefaultScope without projects is All projects; openCount excludes the last column', async () => {
    const a = await activateBoard()
    await a.service.createTask({ projectId: 'p1', title: 'A' })
    await a.service.createTask({ projectId: 'p1', title: 'B', column: 'Done' })
    expect(unwrap(await a.fake.invoke(boardIpc.openCount, { scope: { kind: 'all' } }))).toEqual({ open: 1 })
    a.projects.state.projects = []
    expect(unwrap(await a.fake.invoke(boardIpc.resolveDefaultScope, {}))).toEqual({ kind: 'all' })
  })
})
