import { beforeEach, describe, expect, it } from 'vitest'
import type { TaskDto } from '../src/contract'
import { aProject, aWorktree, makeService, type ServiceHarness } from './support/fakes'

let h: ServiceHarness
let task: TaskDto

async function setup(o: Parameters<typeof makeService>[0] = {}) {
  h = await makeService({
    projects: {
      projects: [aProject('p1', 'pragma-ade'), aProject('p2', 'other', 1)],
      worktrees: [aWorktree('w1', 'p1', 'main', true), aWorktree('w2', 'p2', 'main', true)],
      branches: { p1: ['main', 'feat/pra-1-fix-login'] },
    },
    ...o,
  })
  task = await h.service.createTask({
    projectId: 'p1',
    title: 'Fix login',
    descriptionMd: 'Steps here',
    column: 'Todo',
  })
}
beforeEach(() => setup())

const columnName = async (id: number) => {
  const t = await h.service.getTask(id)
  return (await h.service.getBoard('p1')).columns.find((c) => c.id === t?.columnId)?.name
}
const startNew = (extra: Record<string, unknown> = {}) =>
  h.service.startInNewWorktree({ taskId: task.id, branch: 'feat/pra-1-x', baseBranch: 'main', ...extra })

describe('prepareStart', () => {
  it('suggests a free branch, preselects the default profile and drops disabled ones', async () => {
    const prep = await h.service.prepareStart(task.id)
    expect(prep.suggestedBranch).toBe('feat/pra-1-fix-login-2')
    expect(prep.defaultProfileId).toBe('fake')
    expect(prep.profiles.map((p) => p.id)).toEqual(['fake', 'other'])
    expect(prep.baseBranches).toEqual(['main', 'feat/pra-1-fix-login', 'origin/main'])
    expect(prep.defaultBaseBranch).toBe('main')
    expect(prep.worktrees.map((w) => w.id)).toEqual(['w1'])
  })
})

it.each([
  ['a..b', { ok: false, reason: 'invalid' }],
  ['main', { ok: false, reason: 'exists' }],
  ['feat/new', { ok: true }],
  ['  ', { ok: false, reason: 'invalid' }],
])('checkBranch %j', async (branch, expected) => {
  expect(await h.service.checkBranch('p1', branch)).toEqual(expected)
})

describe('startInNewWorktree', () => {
  it('creates the worktree, starts the agent with the task prompt, links and moves the card', async () => {
    const result = await startNew()
    expect(h.projects.state.created).toEqual([{ projectId: 'p1', branch: 'feat/pra-1-x', baseBranch: 'main' }])
    expect(h.sessions.state.started[0]?.initialPrompt).toBe('Fix login\n\nSteps here')
    expect(result).toMatchObject({ ok: true, worktreeId: 'wt-1', sessionId: 's1' })
    const after = await h.service.getTask(task.id)
    expect(after?.worktreeId).toBe('wt-1')
    expect(after?.sessions[0]?.sessionId).toBe('s1')
    expect(await columnName(task.id)).toBe('In Progress')
  })

  it.each([
    [{ sendPrompt: false }, undefined],
    [{ promptOverride: 'Handoff' }, 'Handoff'],
    [{ sendPrompt: false, promptOverride: 'Handoff' }, 'Handoff'],
  ])('prompt options %o', async (extra, prompt) => {
    await startNew(extra)
    expect(h.sessions.state.started[0]?.initialPrompt).toBe(prompt)
  })

  it('keeps the worktree link when the session start fails', async () => {
    h.sessions.state.failStart = new Error('command not found')
    const result = await startNew()
    expect(result).toEqual({
      ok: false,
      stage: 'session',
      code: 'session_failed',
      message: 'command not found',
      worktreeId: 'wt-1',
    })
    const after = await h.service.getTask(task.id)
    expect(after?.worktreeId).toBe('wt-1')
    expect(after?.sessionIds).toEqual([])
    expect(await columnName(task.id)).toBe('Todo')
  })

  it('an error session (launch failed in 03) is a session-stage failure: linked, the card stays', async () => {
    const message = 'agents:errors.commandNotFound|{"command":"claude"}'
    h.sessions.state.startAs = { status: 'error', error: { code: 'commandNotFound', message } }
    expect(await startNew()).toEqual({
      ok: false,
      stage: 'session',
      code: 'session_failed',
      message,
      worktreeId: 'wt-1',
    })
    expect(await h.service.getTask(task.id)).toMatchObject({ worktreeId: 'wt-1', sessionIds: ['s1'] })
    expect(await columnName(task.id)).toBe('Todo')
  })

  it('changes nothing when the worktree cannot be created', async () => {
    h.projects.state.failCreate = new Error('git failed')
    expect(await startNew()).toMatchObject({ ok: false, stage: 'worktree', code: 'worktree_failed' })
    expect(await h.service.getTask(task.id)).toMatchObject({ worktreeId: null, sessionIds: [] })
  })

  it.each([
    ['main', 'branch_exists'],
    ['a..b', 'invalid_branch'],
  ])('validates the branch %j', async (branch, code) => {
    expect(await startNew({ branch })).toMatchObject({ ok: false, stage: 'validate', code })
    expect(h.projects.state.created).toEqual([])
  })

  it('is ok with movedToColumnId null when there is no In Progress column', async () => {
    const col = (await h.service.getBoard('p1')).columns.find((c) => c.name === 'In Progress')
    await h.service.deleteColumn(col?.id as number)
    expect(await startNew()).toMatchObject({ ok: true, movedToColumnId: null })
  })
})

describe('settings', () => {
  it('moveToInProgressOnStart false leaves the card in place', async () => {
    await setup({ settings: { moveToInProgressOnStart: false } })
    expect(await startNew()).toMatchObject({ ok: true, movedToColumnId: null })
    expect(await columnName(task.id)).toBe('Todo')
  })
  it('sendPromptByDefault false + sendPrompt omitted → no prompt', async () => {
    await setup({ settings: { sendPromptByDefault: false } })
    await startNew()
    expect(h.sessions.state.started[0]?.initialPrompt).toBeUndefined()
  })
})

describe('startInWorktree', () => {
  it('rejects a worktree of another project', async () => {
    const r = await h.service.startInWorktree({ taskId: task.id, worktreeId: 'w2' })
    expect(r).toMatchObject({ ok: false, stage: 'validate', code: 'validation' })
  })
  it('links the worktree and starts there', async () => {
    const r = await h.service.startInWorktree({ taskId: task.id, worktreeId: 'w1', profileId: 'other' })
    expect(r).toMatchObject({ ok: true, worktreeId: 'w1' })
    expect(h.sessions.state.started[0]).toMatchObject({ worktreeId: 'w1', profileId: 'other' })
    expect((await h.service.getTask(task.id))?.worktreeId).toBe('w1')
  })
})

describe('links', () => {
  it('linkSession is idempotent and listTasks({ sessionId }) finds the task', async () => {
    await h.service.linkSession(task.id, 'x1')
    await h.service.linkSession(task.id, 'x1')
    expect((await h.service.listTasks({ sessionId: 'x1' })).map((t) => t.id)).toEqual([task.id])
    expect((await h.service.getTask(task.id))?.sessionIds).toEqual(['x1'])
    await h.service.unlinkSession(task.id, 'x1')
    expect(await h.service.listTasks({ sessionId: 'x1' })).toEqual([])
  })

  it("link emits board.changed with kind 'link'", async () => {
    h.emitted.length = 0
    await h.service.linkSession(task.id, 'x1')
    expect(h.emitted).toEqual([{ projectId: 'p1', taskIds: [task.id], kind: 'link' }])
  })

  it('missing sessions are skipped in the DTO but kept in sessionIds', async () => {
    await h.service.linkSession(task.id, 'gone')
    expect(await h.service.getTask(task.id)).toMatchObject({ sessions: [], sessionIds: ['gone'] })
  })

  it('worktree.removed clears links', async () => {
    await h.service.updateTask(task.id, { worktreeId: 'w1' })
    h.emitted.length = 0
    h.service.handleWorktreeRemoved('w1')
    expect((await h.service.getTask(task.id))?.worktreeId).toBeNull()
    expect(h.emitted).toEqual([{ projectId: 'p1', taskIds: [task.id], kind: 'task' }])
    h.service.handleWorktreeRemoved('unknown')
    expect(h.emitted).toHaveLength(1)
  })
})
