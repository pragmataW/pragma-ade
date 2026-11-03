import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent } from '../../../src/contract'
import { Composer } from '../../../src/renderer/kit/composer/Composer'
import { defaultComposerExtensions, documentAttachmentsExtension } from '../../../src/renderer/kit/composer/extensions'
import { readDocumentFiles } from '../../../src/renderer/kit/composer/read-images'
import { McpStatus } from '../../../src/renderer/kit/controls/McpStatus'
import { PermissionModePicker } from '../../../src/renderer/kit/controls/PermissionModePicker'
import { RateLimitBanner, RetryBanner } from '../../../src/renderer/kit/parts/Banners'
import { stubChatHost, stubSessionApi } from '../../../testing'
import { actions, modes } from '../parts/samples'
import { renderChat } from '../support'

const mcp: ChatEvent = {
  kind: 'mcp-status',
  servers: [
    { name: 'github', status: 'connected', toolCount: 12, scope: 'user' },
    { name: 'db', status: 'failed', error: 'ECONNREFUSED' },
  ],
}

describe('PermissionModePicker', () => {
  it('shows the current mode as a toned badge; the menu lists modes with descriptions', async () => {
    const s = stubSessionApi([modes('acceptEdits')])
    renderChat(<PermissionModePicker session={s.api} />)
    const badge = screen.getByTestId(CHAT_TESTIDS.permissionMode)
    expect(badge).toHaveTextContent('Accept edits')
    expect(badge).toHaveAttribute('data-tone', 'info')
    await userEvent.click(badge)
    expect(screen.getByText('Ask before edits')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permissionModeValue('plan')))
    expect(s.callsOf('setOption')[0]?.args).toEqual(['permissionMode', 'plan'])
  })

  it('a requiresConfirm mode asks first; declined = unchanged, confirmed = set', async () => {
    const declined = stubChatHost({ confirm: async () => false })
    const s = stubSessionApi([modes('default')])
    const { unmount } = renderChat(<PermissionModePicker session={s.api} />, declined)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permissionMode))
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permissionModeValue('bypass')))
    expect(s.callsOf('setOption')).toEqual([])
    unmount()
    const host = stubChatHost()
    renderChat(<PermissionModePicker session={s.api} />, host)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permissionMode))
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permissionModeValue('bypass')))
    await waitFor(() => expect(s.callsOf('setOption')[0]?.args).toEqual(['permissionMode', 'bypass']))
    expect(host.calls.filter((c) => c.method === 'confirm')).toHaveLength(1)
  })

  it('renders nothing without a permissionMode option', () => {
    const { container } = renderChat(<PermissionModePicker session={stubSessionApi().api} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Shift+Tab in the composer cycles modes (skipping cycle:false)', async () => {
    const s = stubSessionApi([modes('plan')])
    renderChat(<Composer session={s.api} extensions={defaultComposerExtensions} />)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.composerInput))
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(s.callsOf('setOption')[0]?.args).toEqual(['permissionMode', 'default'])
  })
})

describe('McpStatus', () => {
  it('shows the worst status and lists servers with status, tools and errors', async () => {
    const s = stubSessionApi([mcp])
    renderChat(<McpStatus session={s.api} />)
    const trigger = screen.getByRole('button', { name: '2 MCP servers' })
    expect(trigger).toHaveAttribute('data-tone', 'err')
    await userEvent.click(trigger)
    expect(within(screen.getByTestId(CHAT_TESTIDS.mcpServer('github'))).getByText(/12 tools/)).toBeInTheDocument()
    expect(within(screen.getByTestId(CHAT_TESTIDS.mcpServer('db'))).getByText('ECONNREFUSED')).toBeInTheDocument()
    expect(screen.queryByTestId(CHAT_TESTIDS.mcpToggle('github'))).toBeNull()
    expect(screen.queryByTestId(CHAT_TESTIDS.mcpReconnect('db'))).toBeNull()
  })

  it('toggle / reconnect / refresh call the session actions the handle offers', async () => {
    const s = stubSessionApi([actions('toggleMcp', 'reconnectMcp', 'refreshMcp'), mcp])
    renderChat(<McpStatus session={s.api} />)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.mcpStatus))
    await userEvent.click(screen.getByRole('switch', { name: 'Enable github' }))
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.mcpReconnect('db')))
    expect(screen.queryByTestId(CHAT_TESTIDS.mcpReconnect('github'))).toBeNull()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.mcpRefresh))
    expect(s.callsOf('action').map((c) => c.args[0])).toEqual([
      { action: 'toggleMcp', name: 'github', enabled: false },
      { action: 'reconnectMcp', name: 'db' },
      { action: 'refreshMcp' },
    ])
  })

  it.each([
    ['no actions', []],
    ['refreshMcp offered', [actions('refreshMcp')]],
  ])('hidden without servers (%s): no "0" in the header', (_label, events) => {
    const { container } = renderChat(<McpStatus session={stubSessionApi(events).api} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('banners', () => {
  it('rate limit: warning with percent, rejected with reset time; status role', () => {
    const warn = stubSessionApi([{ kind: 'rate-limit', status: 'warning', utilization: 0.85 }])
    const { unmount } = renderChat(<RateLimitBanner session={warn.api} />)
    expect(screen.getByRole('status')).toHaveTextContent('Approaching the usage limit (85%)')
    unmount()
    const hit = stubSessionApi([{ kind: 'rate-limit', status: 'rejected', resetsAt: Date.UTC(2026, 0, 1, 12) }])
    renderChat(<RateLimitBanner session={hit.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.rateLimit)).toHaveTextContent(/Usage limit reached.*resets at/)
  })

  it('retry: attempt n/max, delay and reason; nothing once cleared', () => {
    const s = stubSessionApi([{ kind: 'retry', attempt: 2, maxAttempts: 5, delayMs: 2500, reason: 'overloaded' }])
    const { unmount } = renderChat(<RetryBanner session={s.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.retry)).toHaveTextContent('Retrying (2/5)')
    expect(screen.getByTestId(CHAT_TESTIDS.retry)).toHaveTextContent('next try in 2.5s')
    expect(screen.getByTestId(CHAT_TESTIDS.retry)).toHaveTextContent('overloaded')
    unmount()
    const cleared = stubSessionApi([
      { kind: 'retry', attempt: 2 },
      { kind: 'turn-end', reason: 'completed' },
    ])
    const { container } = renderChat(<RetryBanner session={cleared.api} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('document attachments', () => {
  const pdf = () => new File(['%PDF'], 'spec.pdf', { type: 'application/pdf' })

  it('readDocumentFiles accepts PDF/text and rejects others', async () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const { files, rejected } = await readDocumentFiles([pdf(), png])
    expect(files.map((f) => [f.name, f.mediaType])).toEqual([['spec.pdf', 'application/pdf']])
    expect(rejected).toEqual([png])
  })

  it('the attach button adds a removable chip and sends the file with the message', async () => {
    const s = stubSessionApi()
    renderChat(<Composer session={s.api} extensions={[documentAttachmentsExtension, ...defaultComposerExtensions]} />)
    const input = screen.getByTestId(CHAT_TESTIDS.attachFile).previousElementSibling as HTMLInputElement
    await userEvent.upload(input, pdf())
    expect(await screen.findByTestId(CHAT_TESTIDS.attachmentFile)).toHaveTextContent('spec.pdf')
    await userEvent.type(screen.getByTestId(CHAT_TESTIDS.composerInput), 'read this{Enter}')
    expect(s.callsOf('send')[0]?.args[0]).toMatchObject({
      text: 'read this',
      files: [{ name: 'spec.pdf', mediaType: 'application/pdf' }],
    })
    expect(screen.queryByTestId(CHAT_TESTIDS.attachmentFile)).toBeNull()
  })
})
