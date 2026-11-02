import { CHAT_TESTIDS, type ChatEvent, type ChatUiDefinition } from '@pragma/module-chat/contract'
import {
  callsOf,
  chatTestI18n,
  installJsdomLayout,
  makeSession,
  makeTranscript,
  stubChatHost,
} from '@pragma/module-chat/testing'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { describeClaudeOptions } from '../../src/main/chat/options'
import { claudeChatUi } from '../../src/renderer/chat/claude-chat-ui'
import { COMPACT_NOTICE_TESTID, FAST_MODE_TESTID } from '../../src/renderer/chat/constants'
import { ChatHostProvider, ChatSessionView } from '../../src/renderer/chat/kit'
import { FAKE_INIT, FAKE_PLAN, FAKE_QUESTION_INPUT } from '../../testing/fake-claude-stream/scenario'

afterEach(cleanup)
installJsdomLayout()

const i18n = await chatTestI18n(['claude'])
/** The options a real session describes for the fake models (bypass on, fast mode on). */
const options = describeClaudeOptions(
  { models: FAKE_INIT?.models as never },
  { model: null, effort: null, permissionMode: 'bypassPermissions', fastMode: true },
)
const base: ChatEvent[] = [
  { kind: 'thinking', messageId: 'a', partId: 'a:0', text: 'plan', mode: 'snapshot' },
  { kind: 'custom', type: 'claude.compact-boundary', data: { trigger: 'auto', preTokens: 48_000 } },
  { kind: 'text-delta', messageId: 'a', partId: 'a:1', text: 'done', mode: 'snapshot' },
  { kind: 'options', options },
]
const cards: ChatEvent[] = [
  { kind: 'tool-call', toolCallId: 'ag', name: 'Agent', toolKind: 'task', input: {}, status: 'running' },
  { kind: 'task', taskId: 't1', toolCallId: 'ag', taskKind: 'subagent', name: 'Explore', status: 'running' },
  { kind: 'question', eventId: 'q1', questions: [...FAKE_QUESTION_INPUT.questions] },
  { kind: 'plan-proposal', eventId: 'p1', plan: FAKE_PLAN, modes: ['acceptEdits', 'default'] },
  { kind: 'rate-limit', status: 'warning', window: 'five_hour', utilization: 0.92 },
]

async function renderClaude(events: ChatEvent[] = base, definition: ChatUiDefinition = claudeChatUi) {
  const host = stubChatHost({ chatUi: () => definition })
  host.snapshots.set('s1', { providerId: 'claude', transcript: makeTranscript(events), status: 'idle' })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <ChatHostProvider value={host}>{children}</ChatHostProvider>
    </I18nextProvider>
  )
  render(<ChatSessionView session={makeSession({ providerId: 'claude' })} active />, { wrapper })
  await screen.findByText('done')
  return host
}

describe('claudeChatUi', () => {
  it('claude definition renders compact-boundary custom part', async () => {
    await renderClaude()
    expect(screen.getByTestId(COMPACT_NOTICE_TESTID)).toHaveTextContent(
      'Conversation compacted (48,000 tokens summarized)',
    )
  })

  it('removing thinking from a copy of claudeChatUi hides thinking', async () => {
    await renderClaude(base, { ...claudeChatUi, parts: { ...claudeChatUi.parts, thinking: undefined } })
    expect(screen.queryByTestId(CHAT_TESTIDS.part('thinking'))).toBeNull()
  })

  it('effort picker shown only when an effort option is described', async () => {
    await renderClaude([...base, { kind: 'options', options: options.filter((o) => o.key !== 'effort') }])
    expect(screen.queryByTestId(CHAT_TESTIDS.optionPicker('effort'))).toBeNull()
  })

  it('permission mode: the kit badge in the bypass tone', async () => {
    await renderClaude()
    const badge = screen.getByTestId(CHAT_TESTIDS.permissionMode)
    expect(badge).toHaveTextContent('Bypass permissions')
    expect(badge).toHaveAttribute('data-tone', 'err')
  })

  it('fast mode: a pressed bolt that turns it off', async () => {
    const host = await renderClaude()
    const toggle = screen.getByTestId(FAST_MODE_TESTID)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(callsOf(host, 'setOption').at(-1)?.args).toEqual(['s1', 'fastMode', false])
  })

  it('task, question and plan cards and the rate-limit banner render', async () => {
    await renderClaude([...base, ...cards])
    for (const kind of ['task', 'question', 'plan-proposal'] as const)
      expect(screen.getByTestId(CHAT_TESTIDS.part(kind))).toBeInTheDocument()
    expect(screen.getByText('Which test runner should we use?')).toBeInTheDocument()
    expect(screen.getByTestId(CHAT_TESTIDS.rateLimit)).toBeInTheDocument()
  })
})
