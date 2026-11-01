import { aProfile, aSession } from '@pragma/module-agents/testing'
import { CoreCommands } from '@pragma/sdk'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  AGENT_SLOTS,
  AGENTS_IPC,
  AGENTS_TESTIDS,
  type AgentLauncherOptionsProps,
  type ProfileCheck,
  type StartSessionInput,
} from '../../src/contract'
import '../support/render'
import { activateWithFakeContext } from '../support/renderer-context'

const claude = aProfile({
  id: 'builtin:claude',
  providerId: 'claude',
  name: null,
  displayNameKey: 'claude:provider.name',
  isBuiltin: true,
  isDefault: true,
  command: 'claude',
  args: [],
})
const opencode = aProfile({
  id: 'builtin:opencode',
  providerId: 'opencode',
  name: null,
  displayNameKey: 'opencode:provider.name',
  isBuiltin: true,
  command: 'opencode',
  args: ['--standalone'],
  sortOrder: 1,
})
const disabled = aProfile({ id: 'c1', name: 'Hidden', enabled: false })
const okCheck: ProfileCheck = { resolution: { status: 'found', path: '/bin/x' }, compatibility: null }

type Opts = Parameters<typeof activateWithFakeContext>[0]

async function openLauncher(opts: Opts = {}, setup?: (f: ReturnType<typeof activateWithFakeContext>) => void) {
  const profiles = opts.profiles ?? [opencode, claude, disabled]
  const f = activateWithFakeContext({ ...opts, profiles })
  f.backend.replies[AGENTS_IPC.checkProfile] = () => okCheck
  f.backend.replies[AGENTS_IPC.newWorktreeDefaults] = () => ({ baseBranch: 'main' })
  f.backend.replies[AGENTS_IPC.startSession] = (input) =>
    aSession('s1', 1, { worktreeId: (input as StartSessionInput).newWorktree ? 'w9' : 'w1' })
  setup?.(f)
  const View = f.centerViews[0]?.component
  if (!View) throw new Error('no center view registered')
  await f.render(<View />)
  await waitFor(() => expect(f.store().getState().profiles).toHaveLength(profiles.length))
  await act(() => f.ctx.commands.execute('agents.openLauncher', { worktreeId: 'w1' }))
  await screen.findByTestId(AGENTS_TESTIDS.launcher)
  return f
}

const cards = () => screen.getAllByTestId(AGENTS_TESTIDS.launcherProfile)
const checked = () => cards().find((c) => c.getAttribute('aria-checked') === 'true')
const prompt = () => screen.getByTestId(AGENTS_TESTIDS.launcherPrompt)
const startButton = () => screen.getByTestId(AGENTS_TESTIDS.launcherStart)
const startCalls = (f: ReturnType<typeof activateWithFakeContext>) =>
  f.backend.calls.filter(([c]) => c === AGENTS_IPC.startSession).map(([, i]) => i as StartSessionInput)

describe('new agent dialog', () => {
  it('only enabled profiles, default preselected', async () => {
    await openLauncher()
    expect(cards().map((c) => c.textContent)).toEqual([
      expect.stringContaining('Claude Code'),
      expect.stringContaining('OpenCode'),
    ])
    expect(checked()).toHaveAttribute('data-profile-id', 'builtin:claude')
    expect(within(cards()[0] as HTMLElement).getByText('Default')).toBeInTheDocument()
    expect(cards()[1]).toHaveTextContent('opencode --standalone')
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('arrow keys move the selection', async () => {
    await openLauncher()
    ;(checked() as HTMLElement).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(checked()).toHaveAttribute('data-profile-id', 'builtin:opencode')
    await userEvent.keyboard('{ArrowUp}')
    expect(checked()).toHaveAttribute('data-profile-id', 'builtin:claude')
  })

  it('Enter starts; Shift+Enter newline', async () => {
    const f = await openLauncher()
    await userEvent.type(prompt(), 'line one{Shift>}{Enter}{/Shift}line two')
    expect(startCalls(f)).toHaveLength(0)
    expect(prompt()).toHaveValue('line one\nline two')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(startCalls(f)).toHaveLength(1))
    expect(startCalls(f)[0]).toEqual({
      worktreeId: 'w1',
      profileId: 'builtin:claude',
      initialPrompt: 'line one\nline two',
      mode: 'terminal',
    })
    await waitFor(() => expect(screen.queryByTestId(AGENTS_TESTIDS.launcher)).toBeNull())
    expect(f.store().getState().activeSessionId.w1).toBe('s1')
  })

  it('Cmd/Ctrl+Enter starts from anywhere in the dialog', async () => {
    const f = await openLauncher()
    await userEvent.click(cards()[1] as HTMLElement)
    screen.getByTestId(AGENTS_TESTIDS.launcherNewWorktree).focus()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(startCalls(f)).toHaveLength(1))
    expect(startCalls(f)[0]?.profileId).toBe('builtin:opencode')
  })

  it('blank prompt sent as undefined', async () => {
    const f = await openLauncher()
    await userEvent.type(prompt(), '   ')
    await userEvent.click(startButton())
    await waitFor(() => expect(startCalls(f)).toHaveLength(1))
    expect(startCalls(f)[0]?.initialPrompt).toBeUndefined()
  })

  it('mode comes from agentLauncher.options slot', async () => {
    const f = await openLauncher({}, (fx) =>
      fx.registerSlot(AGENT_SLOTS.launcherOptions, {
        id: 'chat',
        order: 1,
        component: (p: AgentLauncherOptionsProps) => (
          <button type="button" onClick={() => p.setOptions({ mode: 'chat' })}>
            {`chat for ${p.profile?.id} in ${p.worktreeId} (${p.options.mode})`}
          </button>
        ),
      } as never),
    )
    await userEvent.click(screen.getByText('chat for builtin:claude in w1 (terminal)'))
    await userEvent.click(startButton())
    await waitFor(() => expect(startCalls(f)).toHaveLength(1))
    expect(startCalls(f)[0]?.mode).toBe('chat')
  })

  it('error shown, dialog stays open', async () => {
    const f = await openLauncher({}, (fx) => {
      fx.backend.replies[AGENTS_IPC.startSession] = () => {
        throw new Error('agents:errors.profileDisabled')
      }
    })
    await userEvent.click(startButton())
    expect(await screen.findByTestId(AGENTS_TESTIDS.launcherError)).toHaveTextContent('This agent profile is disabled')
    expect(screen.getByTestId(AGENTS_TESTIDS.launcher)).toBeInTheDocument()
    expect(f.store().getState().launcher.open).toBe(true)
  })

  it('no launchable profiles disables Start', async () => {
    await openLauncher({ profiles: [disabled] })
    expect(screen.queryAllByTestId(AGENTS_TESTIDS.launcherProfile)).toHaveLength(0)
    expect(screen.getByText('No enabled agents. Enable one in Settings › Agents.')).toBeInTheDocument()
    expect(startButton()).toBeDisabled()
  })

  it('compat warning shown on the card', async () => {
    await openLauncher({}, (fx) => {
      fx.backend.replies[AGENTS_IPC.checkProfile] = (input) =>
        (input as { id: string }).id === opencode.id
          ? {
              resolution: { status: 'found', path: '/bin/opencode' },
              compatibility: {
                ok: false,
                reasonKey: 'opencode:launch.minVersion',
                params: { required: '2.x', found: '1.1.36' },
              },
            }
          : okCheck
    })
    const warning = await within(cards()[1] as HTMLElement).findByTestId(AGENTS_TESTIDS.compatWarning)
    expect(warning).toHaveTextContent('OpenCode 2.x required (found 1.1.36)')
    expect(within(cards()[0] as HTMLElement).queryByTestId(AGENTS_TESTIDS.compatWarning)).toBeNull()
  })

  it('Run in new worktree sends newWorktree with the prefilled branch and base, then selects the new worktree', async () => {
    const f = await openLauncher()
    await userEvent.type(prompt(), 'Fix the Login bug!{Shift>}{Enter}{/Shift}details')
    await userEvent.click(await screen.findByText('New worktree from main'))
    const branch = screen.getByTestId(AGENTS_TESTIDS.launcherBranch)
    expect(branch).toHaveValue('agent/fix-the-login-bug')
    await userEvent.click(startButton())
    await waitFor(() => expect(startCalls(f)).toHaveLength(1))
    expect(startCalls(f)[0]).toMatchObject({
      worktreeId: 'w1',
      newWorktree: { branch: 'agent/fix-the-login-bug', baseBranch: 'main' },
    })
    await waitFor(() => expect(f.executed).toEqual([['projects.selectWorktree', { worktreeId: 'w9' }]]))
    expect(f.store().getState().activeSessionId.w9).toBe('s1')
  })

  it('branch prefill follows the profile name without a prompt and stops once edited', async () => {
    await openLauncher()
    await userEvent.click(await screen.findByText('New worktree from main'))
    const branch = screen.getByTestId(AGENTS_TESTIDS.launcherBranch)
    expect(branch).toHaveValue('agent/claude-code')
    await userEvent.clear(branch)
    await userEvent.type(branch, 'mine')
    await userEvent.type(prompt(), 'Other')
    expect(branch).toHaveValue('mine')
  })

  it('empty branch disables Start in new-worktree mode', async () => {
    await openLauncher()
    await userEvent.click(await screen.findByText('New worktree from main'))
    await userEvent.clear(screen.getByTestId(AGENTS_TESTIDS.launcherBranch))
    expect(startButton()).toBeDisabled()
  })

  it('worktreeCreateFailed error is shown and the dialog stays open', async () => {
    const f = await openLauncher({}, (fx) => {
      fx.backend.replies[AGENTS_IPC.startSession] = () => {
        throw new Error('agents:errors.worktreeCreateFailed|{"message":"branch exists"}')
      }
    })
    await userEvent.click(await screen.findByText('New worktree from main'))
    await userEvent.click(startButton())
    expect(await screen.findByTestId(AGENTS_TESTIDS.launcherError)).toHaveTextContent(
      'The worktree could not be created: branch exists',
    )
    expect(f.executed).toEqual([])
    expect(f.store().getState().launcher.open).toBe(true)
  })

  it('Configure agents… opens Settings › Agents; Cancel closes', async () => {
    const f = await openLauncher()
    const opened: unknown[] = []
    f.ctx.commands.register(CoreCommands.openSettings, (a) => void opened.push(a))
    await userEvent.click(screen.getByTestId(AGENTS_TESTIDS.launcherConfigure))
    expect(opened).toEqual([{ pageId: 'agents' }])
    expect(f.store().getState().launcher.open).toBe(false)
    await act(() => f.ctx.commands.execute('agents.openLauncher', {}))
    await userEvent.click(await screen.findByText('Cancel'))
    expect(f.store().getState().launcher.open).toBe(false)
  })
})
