import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent } from '../../src/contract'
import { useChatStore } from '../../src/renderer/session/store'
import { ChatSessionView } from '../../src/renderer/view/ChatView'
import { makeSession, makeTranscript, stubChatHost } from '../../testing'
import { renderChat } from './support'

const events: ChatEvent[] = [
  { kind: 'message', messageId: 'u', role: 'user', text: 'hello', attachments: [], origin: 'live' },
  { kind: 'thinking', messageId: 'a', partId: 'a:0', text: 'hm', mode: 'snapshot' },
  { kind: 'text-delta', messageId: 'a', partId: 'a:1', text: 'answer', mode: 'snapshot' },
  { kind: 'file-edit', path: 'x.ts', change: 'create', hunks: [{ before: '', after: 'x' }] },
  { kind: 'todo', items: [{ id: '0', text: 'step', status: 'pending' }] },
  {
    kind: 'permission-request',
    requestId: 'r',
    toolName: 'Edit',
    toolKind: 'edit',
    title: 'x',
    input: {},
    options: ['deny'],
  },
  { kind: 'error', code: 'unknown', message: 'oops', fatal: false },
  { kind: 'turn-end', reason: 'interrupted' },
  { kind: 'custom', type: 'nobody.banner', data: { message: 'invisible' } },
  { kind: 'session-exit', exitCode: 0, reason: 'closed' },
]

async function renderView(list: ChatEvent[], waitFor: string) {
  useChatStore.setState({ sessions: {} })
  const host = stubChatHost()
  host.snapshots.set('s1', { providerId: 'fake', transcript: makeTranscript(list), status: 'exited' })
  const view = renderChat(<ChatSessionView session={makeSession()} active />, host)
  await screen.findByTestId(waitFor)
  return view
}

const HALF = 5
const FIRST = ['message', 'thinking', 'text-delta', 'file-edit', 'todo']
const SECOND = ['permission-request', 'turn-end', 'session-exit']

describe('defaultChatUi', () => {
  it('defaultChatUi renders all core kinds and ignores custom', async () => {
    const first = await renderView(events.slice(0, HALF), CHAT_TESTIDS.part('todo'))
    for (const kind of FIRST) expect(screen.getByTestId(CHAT_TESTIDS.part(kind))).toBeInTheDocument()
    expect(screen.getByTestId(CHAT_TESTIDS.turnHeader)).toHaveTextContent('Provider fake')
    first.unmount()
    await renderView(events.slice(HALF), CHAT_TESTIDS.part('session-exit'))
    for (const kind of SECOND) expect(screen.getByTestId(CHAT_TESTIDS.part(kind))).toBeInTheDocument()
    expect(screen.getByTestId(CHAT_TESTIDS.errorRow)).toHaveTextContent('oops')
    expect(screen.queryByText('invisible')).toBeNull()
  })
})
