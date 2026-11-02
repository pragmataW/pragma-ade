import type { LauncherOptions } from '@pragma/module-agents/contract'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CHAT_TESTIDS } from '../../src/contract'
import { LauncherModeOption } from '../../src/renderer/view/LauncherModeOption'
import { makeProfile, stubChatHost } from '../../testing'
import { renderChat } from './support'

function renderOption(host = stubChatHost(), mode = 'terminal') {
  const setOptions = vi.fn<(patch: Partial<LauncherOptions>) => void>()
  const view = renderChat(
    <LauncherModeOption worktreeId="w1" profile={makeProfile()} options={{ mode }} setOptions={setOptions} />,
    host,
  )
  return { ...view, setOptions }
}

describe('LauncherModeOption', () => {
  it('LauncherModeOption disables Chat with translated reason and forces terminal', async () => {
    const host = stubChatHost({
      checkSupport: async () => ({ ok: false, reasonKey: 'chat:unsupported.noProtocol' }),
    })
    const { setOptions } = renderOption(host, 'chat')
    const reason = 'Chat mode not supported: the CLI did not start the stream-json protocol in time'
    expect(await screen.findByTestId(CHAT_TESTIDS.launcherUnsupported)).toHaveTextContent(reason)
    expect(screen.getByTestId(CHAT_TESTIDS.launcherMode('chat'))).toBeDisabled()
    expect(setOptions).toHaveBeenLastCalledWith({ mode: 'terminal' })
  })

  it('LauncherModeOption writes defaultMode on mount when supported', async () => {
    const host = stubChatHost()
    host.currentSettings = { ...host.currentSettings, defaultMode: 'chat' }
    const { setOptions } = renderOption(host)
    await waitFor(() => expect(setOptions).toHaveBeenCalledWith({ mode: 'chat' }))
    expect(screen.queryByTestId(CHAT_TESTIDS.launcherUnsupported)).toBeNull()
  })

  it('LauncherModeOption calls setOptions({mode}) from AgentLauncherOptionsProps', async () => {
    const { setOptions } = renderOption()
    await waitFor(() => expect(setOptions).toHaveBeenCalled())
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.launcherMode('chat')))
    expect(setOptions).toHaveBeenLastCalledWith({ mode: 'chat' })
  })
})
