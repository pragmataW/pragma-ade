import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatUiDefinition } from '../../../src/contract'
import { AssistantText } from '../../../src/renderer/kit/parts/AssistantText'
import { FileEditDiff } from '../../../src/renderer/kit/parts/FileEditDiff'
import { MessageList } from '../../../src/renderer/kit/parts/MessageList'
import { ToolCallCard } from '../../../src/renderer/kit/parts/ToolCallCard'
import { UserMessage } from '../../../src/renderer/kit/parts/UserMessage'
import { stubSessionApi } from '../../../testing'
import { renderChat } from '../support'
import { edit, text, tool, user } from './samples'

const parts: ChatUiDefinition['parts'] = {
  message: UserMessage,
  'text-delta': AssistantText,
  'tool-call': ToolCallCard,
  'file-edit': FileEditDiff,
}

const Header = () => <span data-testid="hdr" />

function renderList(events: ChatEvent[], groupToolCalls = true) {
  const { api } = stubSessionApi(events)
  return renderChat(
    <MessageList items={api.transcript.items} parts={parts} groupToolCalls={groupToolCalls} session={api} />,
  )
}

describe('MessageList', () => {
  it('MessageList renders a window of rows for 1000 items (DOM rows < 100)', () => {
    renderList(Array.from({ length: 1000 }, (_, i) => text(`m:${i}`, `line ${i}`)))
    const rendered = screen.getAllByTestId(CHAT_TESTIDS.part('text-delta')).length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(100)
  })

  it('MessageList skips kinds missing from parts and unknown custom types', () => {
    renderList([
      text('a', 'visible'),
      { kind: 'thinking', messageId: 'm', partId: 't', text: 'hidden', mode: 'snapshot' },
      { kind: 'custom', type: 'nobody.knows', data: {} },
    ])
    expect(screen.getByText('visible')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).toBeNull()
    expect(screen.queryByTestId(CHAT_TESTIDS.part('thinking'))).toBeNull()
  })

  it('consecutive tool calls render one collapsed group with count; file-edit breaks the group', async () => {
    renderList([tool('1'), tool('2'), edit('e'), tool('3')])
    const groups = screen.getAllByTestId(CHAT_TESTIDS.toolGroup)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveTextContent('2 tool calls')
    expect(groups[0]).toHaveAttribute('data-open', 'false')
    expect(screen.getByTestId(CHAT_TESTIDS.part('file-edit'))).toBeInTheDocument()
    const [first] = groups
    await userEvent.click(within(first as HTMLElement).getByTestId(CHAT_TESTIDS.toolGroupToggle))
    expect(within(first as HTMLElement).getAllByTestId(CHAT_TESTIDS.toolRow)).toHaveLength(2)
  })

  it('groupToolCalls false renders cards individually', () => {
    renderList([tool('1'), tool('2')], false)
    expect(screen.queryByTestId(CHAT_TESTIDS.toolGroup)).toBeNull()
    expect(screen.getAllByTestId(CHAT_TESTIDS.part('tool-call'))).toHaveLength(2)
  })

  it('a turn header precedes the first assistant row after a user message', () => {
    const { api } = stubSessionApi([user('u1'), text('a', 'answer')])
    renderChat(<MessageList items={api.transcript.items} parts={parts} turnHeader={Header} session={api} />)
    expect(screen.getAllByTestId('hdr')).toHaveLength(1)
  })
})
