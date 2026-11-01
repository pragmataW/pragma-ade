import { aProfile } from '@pragma/module-agents/testing'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AGENTS_IPC, AGENTS_TESTIDS, type AgentProfile, type ProfileCheck, type ProviderInfo } from '../../src/contract'
import '../support/render'
import { activateWithFakeContext } from '../support/renderer-context'

const T = AGENTS_TESTIDS
const claude = aProfile({
  id: 'builtin:claude',
  providerId: 'claude',
  name: null,
  displayNameKey: 'claude:provider.name',
  isBuiltin: true,
  isDefault: true,
  command: 'claude',
  args: [],
  stockCommand: 'claude',
  stockArgs: [],
})
const dgc = {
  ...claude,
  commandOverride: 'dgc',
  argsOverride: '--dangerously-skip-permissions',
  command: 'dgc',
  args: ['--dangerously-skip-permissions'],
}
const opencode = aProfile({
  id: 'builtin:opencode',
  providerId: 'opencode',
  name: null,
  displayNameKey: 'opencode:provider.name',
  isBuiltin: true,
  command: 'opencode',
  args: ['--standalone'],
  stockCommand: 'opencode',
  stockArgs: ['--standalone'],
  sortOrder: 1,
})
const custom = aProfile({
  id: 'c1',
  providerId: 'custom',
  name: 'Fake',
  commandOverride: 'fake-agent',
  argsOverride: '--alpha',
  command: 'fake-agent',
  args: ['--alpha'],
  sortOrder: 2,
})
const providers: ProviderInfo[] = [
  {
    id: 'claude',
    displayNameKey: 'claude:provider.name',
    icon: 'c',
    defaultCommand: 'claude',
    defaultArgs: [],
    seeded: true,
  },
  {
    id: 'custom',
    displayNameKey: 'custom:provider.name',
    icon: 'x',
    defaultCommand: '',
    defaultArgs: [],
    seeded: false,
  },
]
const found: ProfileCheck = { resolution: { status: 'found', path: '/usr/bin/x' }, compatibility: null }

type Fixture = ReturnType<typeof activateWithFakeContext>

async function mount(profiles: AgentProfile[] = [claude, opencode, custom], setup?: (f: Fixture) => void) {
  const f = activateWithFakeContext({ profiles, providers })
  f.backend.replies[AGENTS_IPC.checkProfile] = () => found
  f.backend.replies[AGENTS_IPC.resolveCommand] = () => found.resolution
  f.backend.replies[AGENTS_IPC.updateProfile] = (i) => profiles.find((p) => p.id === (i as { id: string }).id)
  f.backend.replies[AGENTS_IPC.resetProfile] = () => claude
  f.backend.replies[AGENTS_IPC.createProfile] = () => custom
  setup?.(f)
  const page = f.settingsPages[0]
  if (!page) throw new Error('no settings page registered')
  const Page = page.component
  await f.render(<Page />)
  await waitFor(() => expect(screen.getAllByTestId(T.profileCard)).toHaveLength(profiles.length))
  return f
}
const card = (id: string) => {
  const c = screen.getAllByTestId(T.profileCard).find((e) => e.getAttribute('data-profile-id') === id)
  if (!c) throw new Error(`no card ${id}`)
  return within(c)
}
async function expand(id: string) {
  await userEvent.click(card(id).getByTestId(T.profileExpand))
  return card(id)
}
const calls = (f: Fixture, channel: string) => f.backend.calls.filter(([c]) => c === channel).map(([, i]) => i)

describe('Settings › Agents', () => {
  it('registers the agents page at order 50', async () => {
    const f = await mount()
    expect(f.settingsPages[0]).toMatchObject({ id: 'agents', titleKey: 'agents:settings.title', order: 50 })
  })

  it('customized built-in shows struck stock and effective line', async () => {
    await mount([dgc, opencode])
    const c = card(dgc.id)
    expect(c.getByTestId(T.previewStock).tagName).toBe('S')
    expect(c.getByTestId(T.previewStock)).toHaveTextContent('claude')
    expect(c.getByTestId(T.previewEffective)).toHaveTextContent('dgc --dangerously-skip-permissions')
    expect(card(opencode.id).queryByTestId(T.previewStock)).toBeNull()
    expect(card(opencode.id).getByTestId(T.previewEffective)).toHaveTextContent('opencode --standalone')
  })

  it('command blur saves; an empty command on a built-in saves null', async () => {
    const f = await mount()
    const c = await expand(claude.id)
    const input = c.getByTestId(T.commandInput)
    expect(input).toHaveValue('claude')
    await userEvent.clear(input)
    await userEvent.type(input, 'dgc')
    fireEvent.blur(input)
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.updateProfile)).toEqual([{ id: claude.id, patch: { command: 'dgc' } }]),
    )
    await userEvent.clear(input)
    await userEvent.type(input, '{Enter}')
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.updateProfile)).toContainEqual({ id: claude.id, patch: { command: null } }),
    )
  })

  it('invalid args show error and do not save', async () => {
    const f = await mount()
    const c = await expand(claude.id)
    const input = c.getByTestId(T.argsInput)
    await userEvent.type(input, '--x "unterminated')
    expect(c.getByTestId(T.argsError)).toHaveTextContent('The arguments cannot be parsed')
    fireEvent.blur(input)
    await userEvent.clear(input)
    await userEvent.type(input, '--dangerously-skip-permissions')
    expect(c.queryByTestId(T.argsError)).toBeNull()
    fireEvent.blur(input)
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.updateProfile)).toEqual([
        { id: claude.id, patch: { args: '--dangerously-skip-permissions' } },
      ]),
    )
  })

  it('missing command warning text', async () => {
    await mount([claude], (f) => {
      f.backend.replies[AGENTS_IPC.checkProfile] = () => ({ resolution: { status: 'notFound' }, compatibility: null })
    })
    expect(await card(claude.id).findByTestId(T.commandWarning)).toHaveTextContent('claude was not found on PATH')
  })

  it('reset for built-in only; delete for custom only', async () => {
    const f = await mount([dgc, opencode, custom])
    expect((await expand(dgc.id)).getByTestId(T.reset)).toHaveTextContent('Reset to claude')
    expect((await expand(opencode.id)).queryByTestId(T.reset)).toBeNull()
    expect(card(dgc.id).queryByTestId(T.deleteProfile)).toBeNull()
    const c = await expand(custom.id)
    expect(c.queryByTestId(T.reset)).toBeNull()
    await userEvent.click(card(dgc.id).getByTestId(T.reset))
    await userEvent.click(c.getByTestId(T.deleteProfile))
    await waitFor(() => expect(calls(f, AGENTS_IPC.resetProfile)).toEqual([{ id: dgc.id }]))
    await waitFor(() => expect(calls(f, AGENTS_IPC.deleteProfile)).toEqual([{ id: custom.id }]))
  })

  it('default cannot be disabled; disabled cannot be set default', async () => {
    const off = { ...opencode, enabled: false }
    const f = await mount([claude, off, custom])
    expect(card(claude.id).getByTestId(T.enabledSwitch)).toBeDisabled()
    expect(card(claude.id).queryByTestId(T.setDefault)).toBeNull()
    expect(card(off.id).queryByTestId(T.setDefault)).toBeNull()
    expect(card(off.id).getByText('Disabled')).toBeInTheDocument()
    await userEvent.click(card(custom.id).getByTestId(T.setDefault))
    await userEvent.click(card(custom.id).getByTestId(T.enabledSwitch))
    await waitFor(() => expect(calls(f, AGENTS_IPC.setDefaultProfile)).toEqual([{ id: custom.id }]))
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.updateProfile)).toEqual([{ id: custom.id, patch: { enabled: false } }]),
    )
  })

  it('env editor rejects PRAGMA_ key', async () => {
    const f = await mount()
    const c = await expand(custom.id)
    await userEvent.click(c.getByTestId(T.addVariable))
    await userEvent.type(c.getByTestId(T.envName), 'PRAGMA_X')
    await userEvent.type(c.getByTestId(T.envValue), '1')
    fireEvent.blur(c.getByTestId(T.envValue))
    expect(c.getByTestId(T.envError)).toHaveTextContent('may not start with PRAGMA_')
    expect(calls(f, AGENTS_IPC.updateProfile)).toEqual([])
    await userEvent.clear(c.getByTestId(T.envName))
    await userEvent.type(c.getByTestId(T.envName), 'FOO')
    fireEvent.blur(c.getByTestId(T.envName))
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.updateProfile)).toEqual([{ id: custom.id, patch: { env: { FOO: '1' } } }]),
    )
    expect(c.queryByTestId(T.envError)).toBeNull()
  })

  it('add custom agent', async () => {
    const f = await mount()
    await userEvent.click(screen.getByTestId(T.addCustom))
    const dialog = within(await screen.findByTestId(T.newProfileDialog))
    expect(dialog.getByTestId(T.newProfileProvider)).toHaveTextContent('Custom')
    await userEvent.type(dialog.getByTestId(T.newProfileName), 'Fake')
    await userEvent.type(dialog.getByTestId(T.newProfileCommand), '/tmp/fake-agent')
    await userEvent.type(dialog.getByTestId(T.newProfileArgs), '--alpha "two words"')
    await userEvent.click(dialog.getByTestId(T.newProfileCreate))
    await waitFor(() =>
      expect(calls(f, AGENTS_IPC.createProfile)).toEqual([
        { providerId: 'custom', name: 'Fake', command: '/tmp/fake-agent', args: '--alpha "two words"' },
      ]),
    )
    await waitFor(() => expect(screen.queryByTestId(T.newProfileDialog)).toBeNull())
  })

  it('test launch shows version', async () => {
    await mount([claude], (f) => {
      f.backend.replies[AGENTS_IPC.checkProfile] = () => ({
        resolution: { status: 'found', path: '/opt/bin/claude' },
        compatibility: { ok: true, version: '2.2.5' },
      })
    })
    const c = await expand(claude.id)
    await userEvent.click(c.getByTestId(T.testLaunch))
    expect(await c.findByTestId(T.checkResult)).toHaveTextContent('Found at /opt/bin/claude · v2.2.5')
  })

  it('live typing resolves the command after a debounce', async () => {
    const f = await mount([claude], (fx) => {
      fx.backend.replies[AGENTS_IPC.resolveCommand] = () => ({ status: 'notFound' })
    })
    const c = await expand(claude.id)
    await userEvent.type(c.getByTestId(T.commandInput), 'x')
    await waitFor(() => expect(calls(f, AGENTS_IPC.resolveCommand)).toEqual([{ command: 'claudex' }]))
    expect(await c.findByText('claudex was not found on PATH')).toBeInTheDocument()
  })

  it('behaviour switch updates confirmCloseRunning', async () => {
    const f = await mount()
    const sw = screen.getByTestId(T.confirmCloseSwitch)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(sw)
    expect(f.ctx.settings.get().confirmCloseRunning).toBe(false)
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
  })

  it('profilesChanged refreshes the cards', async () => {
    const f = await mount([claude])
    await act(async () => f.emit('agents.profilesChanged', { profiles: [dgc] }))
    expect(card(claude.id).getByTestId(T.previewEffective)).toHaveTextContent('dgc')
  })
})
