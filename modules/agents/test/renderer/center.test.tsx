import { aProfile, aSession } from '@pragma/module-agents/testing'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { AGENT_SLOTS, AGENTS_IPC, AGENTS_TESTIDS, type AgentSession } from '../../src/contract'
import '../support/render'
import { activateWithFakeContext } from '../support/renderer-context'

const claude = aProfile({ id: 'builtin:claude', name: null, displayNameKey: 'claude:provider.name', isBuiltin: true })
const running = (id: string, n: number, over: Partial<AgentSession> = {}) =>
  aSession(id, n, { profileId: claude.id, providerId: 'claude', ptyId: `pty-${id}`, attachable: true, ...over })

async function mount(opts: Parameters<typeof activateWithFakeContext>[0] = {}) {
  const f = activateWithFakeContext({ profiles: [claude], ...opts })
  const View = f.centerViews[0]?.component
  if (!View) throw new Error('no center view registered')
  await f.render(<View />)
  return f
}
const Probe = ({ session }: { session?: AgentSession }) => <span data-testid="probe">{session?.id}</span>
const tabs = () => screen.queryAllByTestId(AGENTS_TESTIDS.tab)

describe('agents center view', () => {
  it('registers the default agents view and the terminal view entry', async () => {
    const f = await mount()
    expect(f.centerViews[0]).toMatchObject({ id: 'agents', icon: 'bot', default: true })
  })

  it('one tab per session with label "Claude Code · Fix it"', async () => {
    await mount({ sessions: [running('a', 1, { title: 'Fix it' }), running('b', 2)] })
    await waitFor(() => expect(tabs()).toHaveLength(2))
    expect(tabs()[0]).toHaveTextContent('Claude Code · Fix it')
    expect(screen.getByTestId('fake-terminal')).toHaveAttribute('data-pty-id', 'pty-b')
  })

  it("switching active worktree shows that worktree's tabs", async () => {
    const f = await mount({ sessions: [running('a', 1), running('b', 1, { worktreeId: 'w2', title: 'Other' })] })
    await waitFor(() => expect(tabs()).toHaveLength(1))
    await f.setActive('w2')
    await waitFor(() => expect(tabs()[0]).toHaveTextContent('Other'))
    expect(f.backend.calls.filter(([c]) => c === AGENTS_IPC.listSessions)).toHaveLength(2)
  })

  it('body uses the agentSession.view entry whose match accepts the session', async () => {
    const f = activateWithFakeContext({ profiles: [claude], sessions: [running('c', 1, { mode: 'chat' })] })
    f.registerSlot(AGENT_SLOTS.view, {
      id: 'chat',
      order: 20,
      match: (p) => (p.session as AgentSession).mode === 'chat',
      component: () => <div data-testid="chat-stub" />,
    })
    const View = f.centerViews[0]?.component as ComponentType
    await f.render(<View />)
    await screen.findByTestId('chat-stub')
    expect(screen.queryByTestId('fake-terminal')).toBeNull()
  })

  it('tab badges and toolbar slots receive {session}', async () => {
    const f = activateWithFakeContext({ profiles: [claude], sessions: [running('a', 1)] })
    f.registerSlot(AGENT_SLOTS.tabBadges, { id: 'b', order: 1, component: Probe })
    f.registerSlot(AGENT_SLOTS.toolbar, { id: 't', order: 1, component: Probe })
    const View = f.centerViews[0]?.component as ComponentType
    await f.render(<View />)
    await waitFor(() => expect(screen.getAllByTestId('probe').map((e) => e.textContent)).toEqual(['a', 'a']))
  })

  it('running tab close asks; exited closes immediately', async () => {
    const f = await mount({ sessions: [running('a', 1), running('b', 2, { status: 'exited', exitCode: 0 })] })
    await waitFor(() => expect(tabs()).toHaveLength(2))
    await userEvent.click(within(tabs()[1] as HTMLElement).getByTestId(AGENTS_TESTIDS.tabClose))
    expect(f.backend.calls).toContainEqual([AGENTS_IPC.closeSession, { id: 'b' }])
    await userEvent.click(within(tabs()[0] as HTMLElement).getByTestId(AGENTS_TESTIDS.tabClose))
    expect(f.backend.calls).not.toContainEqual([AGENTS_IPC.closeSession, { id: 'a' }])
    await userEvent.click(await screen.findByTestId(AGENTS_TESTIDS.closeConfirm))
    expect(f.backend.calls).toContainEqual([AGENTS_IPC.closeSession, { id: 'a' }])
  })

  it('running tab closes without asking when confirmCloseRunning is off', async () => {
    const f = await mount({ sessions: [running('a', 1)], settings: { confirmCloseRunning: false } })
    await waitFor(() => expect(tabs()).toHaveLength(1))
    await userEvent.click(screen.getByTestId(AGENTS_TESTIDS.tabClose))
    expect(f.backend.calls).toContainEqual([AGENTS_IPC.closeSession, { id: 'a' }])
  })

  it('agents.focusSession selects worktree, activates view and tab', async () => {
    const f = await mount({ sessions: [running('a', 1), running('z', 1, { worktreeId: 'w2', title: 'Zed' })] })
    await act(() => f.ctx.commands.execute('agents.focusSession', { sessionId: 'z' }))
    expect(f.executed).toEqual([['projects.selectWorktree', { worktreeId: 'w2' }]])
    expect(f.activatedViews).toEqual(['agents'])
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Zed'))
    expect(f.backend.calls).toContainEqual([AGENTS_IPC.focusSession, { id: 'z' }])
  })

  it('openLauncher command opens the dialog', async () => {
    const f = await mount()
    await act(() => f.ctx.commands.execute('agents.openLauncher', { worktreeId: 'w1' }))
    expect(f.store().getState().launcher).toEqual({ open: true, worktreeId: 'w1' })
  })

  it('ended placeholder Start again relaunches', async () => {
    const f = await mount({ sessions: [running('a', 1, { status: 'exited', attachable: false, exitCode: 3 })] })
    const notice = await screen.findByTestId(AGENTS_TESTIDS.sessionEnded)
    expect(notice).toHaveTextContent('Exit code 3')
    await userEvent.click(within(notice).getByText('Start again'))
    expect(f.backend.calls).toContainEqual([AGENTS_IPC.relaunchSession, { id: 'a' }])
  })

  it('an error session shows the translated failure', async () => {
    const error = { code: 'commandNotFound' as const, message: 'agents:errors.commandNotFound|{"command":"dgc"}' }
    await mount({ sessions: [running('a', 1, { status: 'error', error, attachable: false })] })
    expect(await screen.findByTestId(AGENTS_TESTIDS.sessionError)).toHaveTextContent('`dgc` was not found on PATH')
  })

  it('a revealed session from main selects its tab; a closed one disappears', async () => {
    const f = await mount({ sessions: [running('a', 1)] })
    await waitFor(() => expect(tabs()).toHaveLength(1))
    await f.emit('agents.sessionChanged', { session: running('b', 2, { title: 'New' }), reveal: true })
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('New')
    await f.emit('agents.sessionChanged', { session: running('b', 2, { closedAt: 9 }), reveal: false })
    expect(tabs()).toHaveLength(1)
  })

  it('no worktree selected shows the hint', async () => {
    await mount({ activeWorktree: null })
    expect(screen.getByText('Select a worktree to start an agent')).toBeInTheDocument()
  })
})
