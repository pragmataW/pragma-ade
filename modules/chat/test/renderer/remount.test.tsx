import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatOptionDescriptor, withCurrent } from '../../src/contract'
import { ChatSessionView } from '../../src/renderer/view/ChatView'
import { makeSession, makeTranscript, stubChatHost } from '../../testing'
import { renderChat } from './support'

const modes: ChatOptionDescriptor = {
  key: 'permissionMode',
  type: 'enum',
  labelKey: 'chat:option.permissionMode',
  values: [
    { value: 'ask', label: 'Ask first' },
    { value: 'plan', label: 'Plan only' },
  ],
  default: 'ask',
  current: 'ask',
}

describe('reopening a chat view', () => {
  it('a remount hydrates from the latest snapshot: the permission picker is back with the current mode', async () => {
    const host = stubChatHost()
    const snapshot = (current: string) => ({
      providerId: 'fake',
      transcript: makeTranscript([{ kind: 'options', options: withCurrent([modes], 'permissionMode', current) }]),
      status: 'idle' as const,
    })
    host.snapshots.set('s1', snapshot('ask'))
    const view = () => <ChatSessionView session={makeSession({ providerId: 'fake' })} active />
    const first = renderChat(view(), host)
    expect(await screen.findByTestId(CHAT_TESTIDS.permissionMode)).toHaveTextContent('Ask first')
    first.unmount()
    host.snapshots.set('s1', snapshot('plan'))
    renderChat(view(), host)
    expect(await screen.findByTestId(CHAT_TESTIDS.permissionMode)).toHaveTextContent('Plan only')
  })
})
