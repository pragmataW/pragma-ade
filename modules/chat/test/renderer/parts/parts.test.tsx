import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatItem, type ChatPartProps, MAX_DIFF_CHARS } from '../../../src/contract'
import { ErrorRow } from '../../../src/renderer/kit/parts/ErrorRow'
import { FileEditDiff } from '../../../src/renderer/kit/parts/FileEditDiff'
import { CHAT_FALLBACK_ICON_TESTID } from '../../../src/renderer/kit/parts/lib/StatusGlyph'
import { PermissionCard } from '../../../src/renderer/kit/parts/PermissionCard'
import { ThinkingBlock } from '../../../src/renderer/kit/parts/ThinkingBlock'
import { TodoList } from '../../../src/renderer/kit/parts/TodoList'
import { ToolCallCard } from '../../../src/renderer/kit/parts/ToolCallCard'
import { WorkingLine } from '../../../src/renderer/kit/parts/WorkingLine'
import { stubChatHost, stubSessionApi } from '../../../testing'
import { renderChat } from '../support'
import { edit, permission, result, tool } from './samples'

const StatusIcon = ({ status }: { status: string }) => <i data-testid="status-icon" data-status={status} />

/** Renders the single item built from `events` with `Part`. */
function renderPart(Part: ComponentType<ChatPartProps<never>>, events: ChatEvent[], host = stubChatHost()) {
  const s = stubSessionApi(events)
  const P = Part as ComponentType<ChatPartProps<ChatItem>>
  const item = s.api.transcript.items[0] as ChatItem
  return { ...renderChat(<P item={item} session={s.api} />, host), ...s }
}

describe('kit parts', () => {
  it('thinking collapsed by default', async () => {
    renderPart(ThinkingBlock, [
      { kind: 'thinking', messageId: 'm', partId: 'p', text: 'secret plan', mode: 'snapshot' },
    ])
    expect(screen.queryByText('secret plan')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Thinking/ }))
    expect(screen.getByText('secret plan')).toBeInTheDocument()
  })

  it('shell body shows command and output', async () => {
    renderPart(ToolCallCard, [tool('1'), result('1', 'file-a\nfile-b')])
    expect(screen.getByTestId(CHAT_TESTIDS.tool('shell'))).toHaveTextContent('Bash')
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('$ ls 1')).toBeInTheDocument()
    expect(screen.getByText(/file-a/)).toBeInTheDocument()
  })

  it('shell body CopyButton copies output via copyText', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPart(ToolCallCard, [tool('1'), result('1', 'copy me')])
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('copy me')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('FileEditDiff renders diff; over-limit shows tooLarge', () => {
    const { unmount } = renderPart(FileEditDiff, [edit('e')])
    expect(screen.getByTestId(CHAT_TESTIDS.part('file-edit'))).toHaveTextContent('src/app.ts')
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(screen.queryByText('Diff too large to display')).toBeNull()
    unmount()
    renderPart(FileEditDiff, [edit('big', 'x'.repeat(MAX_DIFF_CHARS), 'y')])
    expect(screen.getByText('Diff too large to display')).toBeInTheDocument()
  })

  it('PermissionCard buttons follow options and call respondPermission', async () => {
    const { callsOf } = renderPart(PermissionCard, [permission(['allow_once', 'deny'])])
    expect(screen.getByTestId(CHAT_TESTIDS.permission('allow_once'))).toHaveTextContent('Allow')
    expect(screen.queryByTestId(CHAT_TESTIDS.permission('allow_always'))).toBeNull()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.permission('deny')))
    expect(callsOf('respondPermission')[0]?.args).toEqual(['r1', 'deny'])
  })

  it('resolved permission shows outcome only', () => {
    renderPart(PermissionCard, [
      permission(['allow_once', 'allow_always', 'deny']),
      { kind: 'permission-resolved', requestId: 'r1', outcome: 'cancelled' },
    ])
    expect(screen.getByTestId(CHAT_TESTIDS.permissionOutcome)).toHaveTextContent('Cancelled')
    expect(screen.queryByTestId(CHAT_TESTIDS.permission('allow_once'))).toBeNull()
  })

  it('TodoList renders done/active/pending states', () => {
    renderPart(TodoList, [
      {
        kind: 'todo',
        items: [
          { id: '0', text: 'Done one', status: 'done' },
          { id: '1', text: 'Doing', status: 'active' },
          { id: '2', text: 'Later', status: 'pending' },
        ],
      },
    ])
    expect(screen.getByText('Done one')).toHaveClass('line-through')
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['done', 'active', 'pending'])
  })

  it('ErrorRow translates unsupported reason', () => {
    renderPart(ErrorRow, [
      {
        kind: 'error',
        code: 'startup_unsupported',
        message: 'chat:unsupported.noProtocol',
        detail: 'stderr',
        fatal: true,
      },
    ])
    expect(screen.getByTestId(CHAT_TESTIDS.errorRow)).toHaveTextContent(
      'Chat mode not supported: the CLI did not start the stream-json protocol in time',
    )
  })

  it('WorkingLine shows elapsed and only while working', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const idle = stubSessionApi([])
    const { rerender } = renderChat(<WorkingLine session={idle.api} />)
    expect(screen.queryByTestId(CHAT_TESTIDS.workingLine)).toBeNull()
    const working = stubSessionApi([{ kind: 'turn-start', turnId: 't' }, tool('1')], { status: 'working' })
    working.api.transcript.turnStartedAt = Date.now() - 3000
    rerender(<WorkingLine session={working.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.workingLine)).toHaveTextContent('ls 1')
    expect(screen.getByTestId(CHAT_TESTIDS.workingLine)).toHaveTextContent('3s · esc to interrupt')
    act(() => void vi.advanceTimersByTime(2000))
    expect(screen.getByTestId(CHAT_TESTIDS.workingLine)).toHaveTextContent('5s')
    vi.useRealTimers()
  })

  it("tool rows and WorkingLine render 04's StatusIcon; fallback icon when agent-status is absent", () => {
    const { unmount } = renderPart(ToolCallCard, [tool('1')], stubChatHost({ StatusIcon }))
    expect(screen.getByTestId('status-icon')).toHaveAttribute('data-status', 'working')
    unmount()
    renderPart(ToolCallCard, [tool('1'), result('1', 'x')])
    expect(screen.getByTestId(CHAT_FALLBACK_ICON_TESTID)).toHaveAttribute('data-status', 'idle')
  })
})
