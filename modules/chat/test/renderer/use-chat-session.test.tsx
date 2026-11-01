import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ChatEvent, ChatSnapshotDto } from '../../src/contract'
import { ChatHostProvider } from '../../src/renderer/host-adapter'
import { useChatSession } from '../../src/renderer/session/use-chat-session'
import { callsOf, makeEnvelope, makeTranscript, type StubChatHost, stubChatHost } from '../../testing'
import './support'

function renderSession(host: StubChatHost) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChatHostProvider value={host}>{children}</ChatHostProvider>
  )
  return renderHook(() => useChatSession('s1'), { wrapper }).result
}

const delta = (text: string): ChatEvent => ({ kind: 'text-delta', messageId: 'a', partId: 'a:0', text, mode: 'delta' })

describe('useChatSession', () => {
  it('applies an event that arrives between subscribe and open exactly once', async () => {
    let resolve: (s: ChatSnapshotDto) => void = () => undefined
    const host = stubChatHost({ open: () => new Promise((r) => (resolve = r)) })
    const result = renderSession(host)
    expect(result.current).toBeNull()
    act(() => {
      host.emitEvent(makeEnvelope(delta('b'), 2))
      host.emitEvent(makeEnvelope(delta('c'), 3))
      host.emitEvent(makeEnvelope(delta('zz'), 1, 'another-session'))
    })
    await act(async () =>
      resolve({ providerId: 'fake', transcript: makeTranscript([delta('a'), delta('b')]), status: 'working' }),
    )
    await waitFor(() => expect(result.current?.transcript.items[0]).toMatchObject({ text: 'abc' }))
    act(() => host.emitEvent(makeEnvelope(delta('d'), 4)))
    expect(result.current?.transcript.items[0]).toMatchObject({ text: 'abcd' })
  })

  it('actions route through the host with the session id', async () => {
    const host = stubChatHost()
    const result = renderSession(host)
    await waitFor(() => expect(result.current).not.toBeNull())
    await result.current?.send({ text: 'hi', images: [] })
    await result.current?.setOption('model', 'x')
    expect(callsOf(host, 'send')[0]?.args).toEqual(['s1', { text: 'hi', images: [] }])
    expect(callsOf(host, 'setOption')[0]?.args).toEqual(['s1', 'model', 'x'])
  })
})
