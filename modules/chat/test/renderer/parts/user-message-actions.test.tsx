import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent } from '../../../src/contract'
import { createUserMessage } from '../../../src/renderer/kit/parts/UserMessageActions'
import { stubChatHost } from '../../../testing'
import { renderPart } from '../support'
import { actions, user } from './samples'

const REWIND = {
  labelKey: 'chat:task.tree',
  titleKey: 'chat:task.tree',
  messageKey: 'chat:task.empty',
  confirmKey: 'chat:task.tree',
}
const Both = createUserMessage({ rewind: REWIND, fork: { labelKey: 'chat:task.empty' } })
const RewindOnly = createUserMessage({ rewind: REWIND })

const render = (events: ChatEvent[], Part = Both, confirm = true) =>
  renderPart(Part, events, { kind: 'message', host: stubChatHost({ confirm: async () => confirm }) })

describe('createUserMessage (rewind / fork hover actions)', () => {
  it('rewind asks first (the provider copy), then runs the action; fork runs at once', async () => {
    const r = render([actions('rewind', 'fork'), user('m1')])
    expect(screen.getByTestId(CHAT_TESTIDS.part('message'))).toHaveTextContent('hi')
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.messageRewind))
    await waitFor(() => expect(r.callsOf('action')[0]?.args).toEqual([{ action: 'rewind', messageId: 'm1' }]))
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.messageFork))
    expect(r.callsOf('action')[1]?.args).toEqual([{ action: 'fork', messageId: 'm1' }])
  })

  it('a declined confirmation does not rewind', async () => {
    const r = render([actions('rewind'), user('m1')], Both, false)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.messageRewind))
    await waitFor(() => expect(r.callsOf('action')).toEqual([]))
  })

  it.each([
    ['the session does not offer it', [user('m1')], Both],
    [
      'a turn is running',
      [actions('rewind', 'fork'), user('m1'), { kind: 'turn-start', turnId: 't1' } as ChatEvent],
      Both,
    ],
  ])('hidden while %s', (_label, events, Part) => {
    render(events, Part)
    expect(screen.queryByTestId(CHAT_TESTIDS.messageRewind)).toBeNull()
    expect(screen.queryByTestId(CHAT_TESTIDS.messageFork)).toBeNull()
  })

  it('only the configured actions show (no fork copy → no fork button)', () => {
    render([actions('rewind', 'fork'), user('m1')], RewindOnly)
    expect(screen.getByTestId(CHAT_TESTIDS.messageRewind)).toBeInTheDocument()
    expect(screen.queryByTestId(CHAT_TESTIDS.messageFork)).toBeNull()
  })
})
