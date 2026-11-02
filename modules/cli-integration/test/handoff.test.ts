import { aProfile, aSession } from '@pragma/module-agents/testing'
import { ProjectsError } from '@pragma/module-projects/contract'
import { slugify } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import { HANDOFF_SLUG_MAX } from '../src/constants'
import type { CliRequest } from '../src/contract'
import { buildHandoffPrompt, deriveHandoffBranch, type HandoffDeps, runHandoff } from '../src/main/handoff'
import type { NotificationRequest } from '../src/main/notifier'
import { createNotifier } from '../src/main/notifier'
import { aTask, aWorktree, fakeAgents, fakeBoard, fakeProjects, silentLog } from './support/fakes'

const NOW = new Date('2026-11-02T08:30:00Z')
const DOC = '# Fix login\n\nGoal: users can log in again.\n'
const BRANCH_RE = /^handoff\/fix-login-\d{8}-\d{4}$/

function setup(o: { failStart?: Error; failCreate?: Error; tasks?: ReturnType<typeof aTask>[] } = {}) {
  const projects = fakeProjects({
    worktrees: [aWorktree('w1', { branch: 'feature/login', path: '/repo' })],
    failCreate: o.failCreate,
  })
  const agents = fakeAgents({
    profiles: [aProfile({ id: 'claude', name: 'Claude' }), aProfile({ id: 'oc', name: 'OpenCode' })],
    sessions: [aSession('s0', 1, { worktreeId: 'w1', profileId: 'claude' })],
    failStart: o.failStart,
  })
  const board = fakeBoard(o.tasks ?? [aTask(42), aTask(9, { descriptionMd: 'Old body', sessionIds: ['s0'] })])
  const shown: NotificationRequest[] = []
  const deps: HandoffDeps = {
    projects,
    agents,
    board,
    notifier: createNotifier({ show: (n) => shown.push(n) }),
    now: () => NOW,
    log: silentLog(),
    nameOf: (p) => p.name ?? p.id,
  }
  return { projects, agents, board, shown, deps }
}

const request = (over: Partial<CliRequest<'handoff'>> = {}): CliRequest<'handoff'> => ({
  context: { cwd: '/elsewhere', worktreeId: 'w1', sessionId: 's0' },
  to: 'opencode',
  sameWorktree: false,
  document: DOC,
  ...over,
})

describe('runHandoff', () => {
  it('creates a worktree from the source branch and starts the target with the wrapped document', async () => {
    const t = setup()
    const result = await runHandoff(request(), t.deps)
    expect(t.projects.state.created).toEqual([
      { projectId: 'p1', branch: expect.stringMatching(BRANCH_RE), baseBranch: 'feature/login' },
    ])
    const prompt = t.agents.state.started[0]?.initialPrompt ?? ''
    expect(prompt).toContain('<handoff-document>\n# Fix login')
    expect(prompt).toContain('(Claude on branch feature/login)')
    expect(t.agents.state.started[0]).toMatchObject({ profileId: 'oc', worktreeId: result.worktree.id })
    expect(result).toMatchObject({ createdWorktree: true, taskId: null, session: { profileName: 'OpenCode' } })
  })

  it('--same-worktree reuses the source worktree', async () => {
    const t = setup()
    const result = await runHandoff(request({ sameWorktree: true }), t.deps)
    expect(t.projects.state.created).toEqual([])
    expect(result).toMatchObject({ createdWorktree: false, worktree: { id: 'w1' } })
  })

  it('--task links the session and moves the card to In Progress', async () => {
    const t = setup()
    const result = await runHandoff(request({ taskId: '42' }), t.deps)
    expect(t.board.state.calls).toContainEqual(['linkSession', 42, result.session.id])
    expect(t.board.state.calls).toContainEqual(['moveTask', 42, 'In Progress'])
    expect(result.taskId).toBe(42)
  })

  it("notes the source session's card", async () => {
    const t = setup()
    const result = await runHandoff(request(), t.deps)
    const update = t.board.state.calls.find((c) => c[0] === 'updateTask')
    expect(update?.[1]).toBe(9)
    const body = (update?.[2] as { descriptionMd: string } | undefined)?.descriptionMd ?? ''
    expect(body.startsWith('Old body\n\n---\n')).toBe(true)
    expect(body).toMatch(/Handed off to OpenCode \(session s1\) on branch `handoff\//)
    expect(body).toContain('2026-11-02T08:30:00.000Z')
    expect(result.sourceTaskIds).toEqual([9])
  })

  it('a failing card note is not fatal and is left out of sourceTaskIds', async () => {
    const t = setup()
    t.board.state.failUpdate = true
    expect((await runHandoff(request(), t.deps)).sourceTaskIds).toEqual([])
  })

  it('an unknown --task fails before creating a worktree', async () => {
    const t = setup()
    await expect(runHandoff(request({ taskId: '404' }), t.deps)).rejects.toMatchObject({ code: 'not_found' })
    expect(t.projects.state.created).toEqual([])
  })

  it('--task without the board module → module_unavailable before anything is created', async () => {
    const t = setup()
    await expect(runHandoff(request({ taskId: '42' }), { ...t.deps, board: undefined })).rejects.toMatchObject({
      code: 'module_unavailable',
    })
    expect(t.projects.state.created).toEqual([])
  })

  it('reports the created worktree when startSession fails', async () => {
    const t = setup({ failStart: new Error('spawn failed') })
    const err = await runHandoff(request({ branch: 'handoff/x' }), t.deps).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'internal', details: { worktreeId: 'w2' } })
    expect((err as Error).message).toContain("Created worktree 'handoff/x' (w2)")
    expect((err as Error).message).toContain('spawn failed')
    expect(t.projects.state.removed).toEqual([])
  })

  it('a session that ended in error also reports the created worktree', async () => {
    const t = setup()
    const start = t.agents.startSession.bind(t.agents)
    t.agents.startSession = async (input) => ({ ...(await start(input)), status: 'error' as const })
    await expect(runHandoff(request(), t.deps)).rejects.toMatchObject({ details: { worktreeId: 'w2' } })
  })

  it('an existing branch → conflict mentioning --branch', async () => {
    const t = setup({ failCreate: new ProjectsError('branchCheckedOut', 'main') })
    const err = await runHandoff(request({ branch: 'main' }), t.deps).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'conflict' })
    expect((err as Error).message).toContain('--branch')
  })

  it('notifies once with the new session', async () => {
    const t = setup()
    const result = await runHandoff(request(), t.deps)
    expect(t.shown).toHaveLength(1)
    expect(t.shown[0]?.onClickCommand).toEqual({ id: 'agents.focusSession', args: { sessionId: result.session.id } })
  })
})

describe('deriveHandoffBranch', () => {
  const longTitle = 'A very long heading that keeps going well past the forty character limit'
  it.each([
    ['heading', '# Fix login\nbody', 'fix-login'],
    ['first line without heading', '\n\nRefactor the parser!\nmore', 'refactor-the-parser'],
    ['punctuation only', '# !!!\n', 'task'],
    ['long heading truncated', `## ${longTitle}`, slugify(longTitle, { maxLength: HANDOFF_SLUG_MAX })],
  ])('%s', (_name, doc, slug) => {
    expect(deriveHandoffBranch(doc, NOW)).toBe(`handoff/${slug}-20261102-0830`)
  })
})

describe('buildHandoffPrompt', () => {
  it('omits the source when unknown', () => {
    expect(buildHandoffPrompt('doc', null)).toMatch(/^You are taking over work handed off from another agent\.\n/)
  })
})
