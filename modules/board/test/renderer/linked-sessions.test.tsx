import { agentsCommands } from '@pragma/module-agents/contract'
import { ProjectsRendererServiceToken, projectsCommands } from '@pragma/module-projects/contract'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOARD_TESTID_ATTRS as A, boardIpc, type StartPrep, BOARD_TESTIDS as T } from '../../src/contract'
import { LinkedSessions } from '../../src/renderer/components/LinkedSessions'
import { TaskCard } from '../../src/renderer/components/TaskCard'
import { WorktreeField } from '../../src/renderer/components/WorktreeField'
import { type BoardRendererContext, setBoardCtx } from '../../src/renderer/lib/runtime'
import { setError, useBoardStore } from '../../src/renderer/store'
import { aLinkedSession, aTask } from '../support/builders'

// The card's status slot and provider logos need the shell host, which these tests do not mount.
vi.mock('@pragma/sdk/renderer', async (actual) => ({
  ...(await actual<object>()),
  Slot: () => null,
  ProviderIcon: () => null,
}))

const execute = vi.fn()
const invoke = vi.fn(async (contract: unknown) => ({ ok: true, value: contract === boardIpc.listProjects ? [] : null }))

/** 01 lists `w1` only (`w9` was removed). */
function withCtx(worktreeIds = ['w1']) {
  const snapshot = { worktrees: worktreeIds.map((id) => ({ id, branch: id })) }
  const projects = { subscribe: () => () => {}, getSnapshot: () => snapshot }
  const services = { get: (token: unknown) => (token === ProjectsRendererServiceToken ? projects : undefined) }
  setBoardCtx({ commands: { execute }, services, ipc: { invoke } } as unknown as BoardRendererContext)
}

const prep: StartPrep = {
  taskId: 1,
  projectId: 'p1',
  suggestedBranch: 'feat/x',
  baseBranches: ['main'],
  defaultBaseBranch: 'main',
  profiles: [{ id: 'fake', name: 'Fake', displayNameKey: null, providerId: 'custom', isDefault: true }],
  defaultProfileId: 'fake',
  worktrees: [{ id: 'w1', branch: 'w1', path: '/wt/w1', isMain: true }],
}

const row = (sessionId: string) =>
  screen.getAllByTestId(T.drawerSession).find((r) => r.getAttribute(A.sessionId) === sessionId) as HTMLElement
const goto = (sessionId: string) =>
  row(sessionId).querySelector(`[data-testid="${T.gotoSession}"]`) as HTMLButtonElement
const hintOf = (el: HTMLElement) => el.parentElement?.getAttribute('title') ?? null

afterEach(() => {
  execute.mockReset()
  invoke.mockClear()
  setBoardCtx(undefined)
  setError(null)
  document.body.innerHTML = ''
})

describe('LinkedSessions', () => {
  const task = aTask({
    sessions: [
      aLinkedSession('open'),
      aLinkedSession('ended', { ended: true }),
      aLinkedSession('orphan', { worktreeId: 'w9' }),
    ],
    sessionIds: ['open', 'ended', 'orphan'],
  })

  it('only an open session in a listed worktree can be gone to; the others show Ended and say why', () => {
    withCtx()
    render(<LinkedSessions task={task} />)
    expect(goto('open').disabled).toBe(false)
    expect(hintOf(goto('open'))).toBeNull()
    expect(row('open').querySelector(`[data-testid="${T.drawerSessionEnded}"]`)).toBeNull()
    expect(goto('ended').disabled).toBe(true)
    expect(hintOf(goto('ended'))).toBe('board:sessions.unavailable.ended')
    expect(goto('orphan').disabled).toBe(true)
    expect(hintOf(goto('orphan'))).toBe('board:sessions.unavailable.worktreeRemoved')
    for (const id of ['ended', 'orphan']) {
      expect(row(id).getAttribute(A.availability)).not.toBe('open')
      expect(row(id).querySelector(`[data-testid="${T.drawerSessionEnded}"]`)?.textContent).toBe('board:sessions.ended')
      expect(row(id).querySelector<HTMLButtonElement>(`[data-testid="${T.unlinkSession}"]`)?.disabled).toBe(false)
    }
    fireEvent.click(goto('ended'))
    expect(execute).not.toHaveBeenCalled()
  })

  it('Go to agent selects the worktree, then focuses the session', async () => {
    withCtx()
    execute.mockResolvedValue(undefined)
    render(<LinkedSessions task={task} />)
    fireEvent.click(goto('open'))
    await waitFor(() => expect(execute).toHaveBeenCalledWith(agentsCommands.focusSession.id, { sessionId: 'open' }))
    expect(execute).toHaveBeenCalledWith(projectsCommands.selectWorktree.id, { worktreeId: 'w1' })
  })

  it('a jump that loses the race shows a friendly message (no raw code) and refetches the board', async () => {
    withCtx()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    execute.mockRejectedValue(new Error('worktreeNotFound: w1'))
    render(<LinkedSessions task={task} />)
    fireEvent.click(goto('open'))
    await waitFor(() => expect(useBoardStore.getState().error).toEqual({ messageKey: 'board:error.sessionGone' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith(boardIpc.listProjects, {}))
  })
})

describe('WorktreeField', () => {
  const field = (worktreeId: string) =>
    render(
      <WorktreeField task={aTask({ worktreeId })} prep={prep} running={false} onStartHere={() => execute('start')} />,
    )

  it('a listed worktree can be gone to and started in', () => {
    withCtx()
    field('w1')
    expect(screen.getByTestId<HTMLButtonElement>(T.gotoWorktree).disabled).toBe(false)
    expect(screen.getByTestId<HTMLButtonElement>(T.startInWorktree).disabled).toBe(false)
    expect(hintOf(screen.getByTestId(T.gotoWorktree))).toBeNull()
  })

  it('a removed worktree turns Go to worktree and Start agent in this worktree off, with a hint', () => {
    withCtx()
    field('w9')
    for (const id of [T.gotoWorktree, T.startInWorktree]) {
      const button = screen.getByTestId<HTMLButtonElement>(id)
      expect(button.disabled).toBe(true)
      expect(hintOf(button)).toBe('board:worktree.removed')
      fireEvent.click(button)
    }
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('TaskCard agent marks', () => {
  it('a mark of a closed session is muted and says why', () => {
    withCtx()
    const task = aTask({
      sessions: [aLinkedSession('a'), aLinkedSession('b', { ended: true })],
      sessionIds: ['a', 'b'],
    })
    render(<TaskCard task={task} section={undefined} showProject={false} selected={false} onOpen={() => {}} />)
    const [a, b] = screen.getAllByTestId(T.cardSession)
    expect(a?.getAttribute(A.availability)).toBe('open')
    expect(a?.className).not.toContain('opacity')
    expect(b?.getAttribute(A.availability)).toBe('ended')
    expect(b?.className).toContain('opacity')
    expect(b?.getAttribute('title')).toContain('board:sessions.unavailable.ended')
  })
})
