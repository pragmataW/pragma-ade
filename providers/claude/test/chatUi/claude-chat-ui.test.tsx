import {
  CHAT_TESTIDS,
  type ChatEvent,
  type ChatOptionDescriptor,
  type ChatUiDefinition,
} from '@pragma/module-chat/contract'
import {
  chatTestI18n,
  installJsdomLayout,
  makeSession,
  makeTranscript,
  stubChatHost,
} from '@pragma/module-chat/testing'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { claudeChatUi } from '../../src/renderer/chat/claude-chat-ui'
import { COMPACT_NOTICE_TESTID } from '../../src/renderer/chat/constants'
import { ChatHostProvider, ChatSessionView } from '../../src/renderer/chat/kit'

afterEach(cleanup)
installJsdomLayout()

const i18n = await chatTestI18n(['claude'])
const permissionMode: ChatOptionDescriptor = {
  key: 'permissionMode',
  type: 'enum',
  labelKey: 'chat:option.permissionMode',
  values: [
    { value: 'default', labelKey: 'claude:chat.permissionMode.default' },
    { value: 'bypassPermissions', labelKey: 'claude:chat.permissionMode.bypassPermissions', warn: true },
  ],
  default: 'default',
  current: 'bypassPermissions',
}
const base: ChatEvent[] = [
  { kind: 'thinking', messageId: 'a', partId: 'a:0', text: 'plan', mode: 'snapshot' },
  { kind: 'custom', type: 'claude.compact-boundary', data: { trigger: 'auto', preTokens: 48_000 } },
  { kind: 'text-delta', messageId: 'a', partId: 'a:1', text: 'done', mode: 'snapshot' },
  { kind: 'options', options: [permissionMode] },
]

async function renderClaude(definition: ChatUiDefinition = claudeChatUi) {
  const host = stubChatHost({ chatUi: () => definition })
  host.snapshots.set('s1', { providerId: 'claude', transcript: makeTranscript(base), status: 'idle' })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <ChatHostProvider value={host}>{children}</ChatHostProvider>
    </I18nextProvider>
  )
  render(<ChatSessionView session={makeSession({ providerId: 'claude' })} active />, { wrapper })
  await screen.findByText('done')
}

describe('claudeChatUi', () => {
  it('claude definition renders compact-boundary custom part', async () => {
    await renderClaude()
    expect(screen.getByTestId(COMPACT_NOTICE_TESTID)).toHaveTextContent(
      'Conversation compacted (48,000 tokens summarized)',
    )
  })

  it('removing thinking from a copy of claudeChatUi hides thinking', async () => {
    await renderClaude({ ...claudeChatUi, parts: { ...claudeChatUi.parts, thinking: undefined } })
    expect(screen.queryByTestId(CHAT_TESTIDS.part('thinking'))).toBeNull()
  })

  it('effort picker hidden when no effort option is described', async () => {
    await renderClaude()
    expect(screen.queryByTestId(CHAT_TESTIDS.optionPicker('effort'))).toBeNull()
  })

  it('permissionMode bypass value shown in warn colour', async () => {
    await renderClaude()
    const picker = screen.getByTestId(CHAT_TESTIDS.optionPicker('permissionMode'))
    expect(picker).toHaveTextContent('Bypass permissions')
    expect(picker).toHaveClass('text-warn')
  })
})
