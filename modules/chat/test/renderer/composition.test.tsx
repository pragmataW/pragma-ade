import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent } from '../../src/contract'
import { ChatSessionView } from '../../src/renderer/view/ChatView'
import { callsOf, FAKE_OPTIONS, makeSession, makeTranscript, stubChatHost } from '../../testing'
import { FAKE_BANNER_TESTID, FAKE_REPLY_TESTID, fakeChatUi } from '../../testing/fake-chat-ui'
import { renderChat } from './support'

const events = (banner: Partial<Extract<ChatEvent, { kind: 'custom' }>> = {}): ChatEvent[] => [
  { kind: 'options', options: FAKE_OPTIONS },
  { kind: 'thinking', messageId: 'a', partId: 'a:0', text: 'hidden thoughts', mode: 'snapshot' },
  { kind: 'text-delta', messageId: 'a', partId: 'a:1', text: 'visible answer', mode: 'snapshot' },
  { kind: 'custom', type: 'fake.banner', data: { message: 'Fake banner!', reply: 'OK' }, ...banner },
]

async function renderWith(list: ChatEvent[], useFake = true) {
  const host = stubChatHost({ chatUi: (id) => (useFake && id === 'fake' ? fakeChatUi : undefined) })
  host.snapshots.set('s1', { providerId: 'fake', transcript: makeTranscript(list), status: 'idle' })
  renderChat(<ChatSessionView session={makeSession({ providerId: 'fake' })} active />, host)
  await screen.findByText('visible answer')
  return host
}

describe('per-provider composition', () => {
  it('fake provider custom part renders', async () => {
    await renderWith(events())
    expect(screen.getByTestId(FAKE_BANNER_TESTID)).toHaveTextContent('Fake banner!')
  })

  it('thinking omitted by definition is not rendered', async () => {
    await renderWith(events())
    expect(screen.queryByTestId(CHAT_TESTIDS.part('thinking'))).toBeNull()
  })

  it("custom option picker renders and setOption('fakeMode','b') is called on select", async () => {
    const host = await renderWith(events())
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.optionPicker('fakeMode')))
    await userEvent.click(await screen.findByTestId(CHAT_TESTIDS.optionValue('fakeMode', 'b')))
    expect(callsOf(host, 'setOption')[0]?.args).toEqual(['s1', 'fakeMode', 'b'])
  })

  it('interactive custom part replies through useCustomResponse → chat.respond', async () => {
    const host = await renderWith(events({ eventId: 'ev-1', awaitsResponse: true }))
    await userEvent.click(screen.getByTestId(FAKE_REPLY_TESTID))
    expect(callsOf(host, 'respond')[0]?.args).toEqual(['s1', 'ev-1', { answer: 'OK' }])
  })

  it('the same transcript under defaultChatUi renders thinking and ignores fake.banner', async () => {
    await renderWith(events(), false)
    expect(screen.getByTestId(CHAT_TESTIDS.part('thinking'))).toBeInTheDocument()
    expect(screen.queryByTestId(FAKE_BANNER_TESTID)).toBeNull()
  })
})
