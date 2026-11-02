import { CHAT_TESTIDS, type ChatEvent, type ChatUiDefinition, type CustomItem } from '@pragma/module-chat/contract'
import {
  chatTestI18n,
  installJsdomLayout,
  makeSession,
  makeTranscript,
  stubChatHost,
  stubSessionApi,
} from '@pragma/module-chat/testing'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { CUSTOM_CHOICE, OPENCODE_CHAT_TESTIDS as IDS } from '../src/renderer/chat/constants'
import { FormCard } from '../src/renderer/chat/FormCard'
import { ChatHostProvider, ChatSessionView } from '../src/renderer/chat/kit'
import { opencodeChatUi } from '../src/renderer/chat/opencode-chat-ui'
import { CUSTOM } from '../src/renderer/chat/payloads'
import { RetryNotice } from '../src/renderer/chat/RetryNotice'

afterEach(cleanup)
installJsdomLayout()

const i18n = await chatTestI18n(['opencode'])
const wrapper = ({ children }: { children: ReactNode }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>

const formData = {
  formId: 'frm_1',
  title: 'Pick a color',
  fields: [
    {
      key: 'color',
      type: 'string',
      title: 'Color',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
      custom: true,
    },
    { key: 'confirm', type: 'boolean', title: 'Confirm', required: true },
  ],
}
const formEvent: ChatEvent = {
  kind: 'custom',
  type: CUSTOM.form,
  data: formData,
  eventId: 'frm_1',
  awaitsResponse: true,
}

function formItem(extra: ChatEvent[] = []): CustomItem {
  const item = makeTranscript([formEvent, ...extra]).items.find((i) => i.kind === 'custom')
  if (item?.kind !== 'custom') throw new Error('no form item')
  return item
}

function renderForm(extra: ChatEvent[] = []) {
  const stub = stubSessionApi()
  render(<FormCard item={formItem(extra)} session={stub.api} />, { wrapper })
  return { ...stub, user: userEvent.setup() }
}

describe('opencodeChatUi', () => {
  it('definition maps every kind the adapter emits', () => {
    for (const k of [
      'message',
      'text-delta',
      'thinking',
      'tool-call',
      'file-edit',
      'todo',
      'permission-request',
      'error',
      'turn-end',
      'session-exit',
      `custom:${CUSTOM.form}`,
      `custom:${CUSTOM.retry}`,
    ] as const)
      expect(opencodeChatUi.parts[k], k).toBeTypeOf('function')
    expect(opencodeChatUi.composerToolbar).toHaveLength(5)
  })

  it('FormCard submits answers via session.respond', async () => {
    const { user, callsOf } = renderForm()
    expect(screen.getByTestId(IDS.form)).toHaveTextContent('Pick a color')
    expect(screen.getByTestId(IDS.form)).toHaveTextContent('Required')
    await user.click(screen.getByTestId(IDS.formOption('color', 'red')))
    await user.click(screen.getByTestId(IDS.formField('confirm')))
    await user.click(screen.getByTestId(IDS.formSubmit))
    expect(callsOf('respond')[0]?.args).toEqual(['frm_1', { color: 'red', confirm: true }])
    expect(screen.getByTestId(IDS.formSubmit)).toBeDisabled()
  })

  it('FormCard custom "Other…" sends free text', async () => {
    const { user, callsOf } = renderForm()
    await user.click(screen.getByTestId(IDS.formOption('color', CUSTOM_CHOICE)))
    await user.type(screen.getByTestId(IDS.formCustom('color')), 'teal')
    await user.click(screen.getByTestId(IDS.formSubmit))
    expect(callsOf('respond')[0]?.args).toEqual(['frm_1', { color: 'teal', confirm: false }])
  })

  it('FormCard skip sends cancel', async () => {
    const { user, callsOf } = renderForm()
    await user.click(screen.getByTestId(IDS.formCancel))
    expect(callsOf('respond')[0]?.args).toEqual(['frm_1', { cancel: true }])
  })

  it.each([
    ['answered', 'Answered'],
    ['cancelled', 'Skipped'],
  ] as const)('FormCard is disabled with a %s badge after response-resolved', (outcome, text) => {
    renderForm([{ kind: 'response-resolved', eventId: 'frm_1', outcome }])
    expect(screen.getByTestId(IDS.formOutcome)).toHaveTextContent(text)
    expect(screen.queryByTestId(IDS.formSubmit)).toBeNull()
    expect(screen.getByTestId(IDS.formOption('color', 'red'))).toBeDisabled()
  })

  it('RetryNotice renders attempt', () => {
    const item = makeTranscript([
      { kind: 'custom', type: CUSTOM.retry, data: { attempt: 2, at: 0, message: 'rate limited' } },
    ]).items[0] as CustomItem
    render(<RetryNotice item={item} session={stubSessionApi().api} />, { wrapper })
    expect(screen.getByTestId(IDS.retry)).toHaveTextContent('Retrying (attempt 2)rate limited')
  })

  it('opencode error keys are translated with their detail', async () => {
    await renderView(opencodeChatUi, [
      {
        kind: 'error',
        code: 'startup_unsupported',
        message: 'opencode:chat.unsupported.upgradeRequired',
        detail: '1.1.36',
        fatal: true,
      },
    ])
    expect(screen.getByTestId(CHAT_TESTIDS.errorRow)).toHaveTextContent(
      'Chat mode needs OpenCode 2.x (found 1.1.36). Please upgrade OpenCode.',
    )
  })

  it('removing thinking from a copy hides thinking (one-line toggle)', async () => {
    const events: ChatEvent[] = [
      { kind: 'thinking', messageId: 'a', partId: 'a:reasoning:0', text: 'hmm', mode: 'snapshot' },
      { kind: 'text-delta', messageId: 'a', partId: 'a:text:1', text: 'done', mode: 'snapshot' },
    ]
    await renderView(opencodeChatUi, events)
    expect(screen.getByTestId(CHAT_TESTIDS.part('thinking'))).toBeInTheDocument()
    cleanup()
    await renderView({ ...opencodeChatUi, parts: { ...opencodeChatUi.parts, thinking: undefined } }, events)
    expect(screen.queryByTestId(CHAT_TESTIDS.part('thinking'))).toBeNull()
  })
})

async function renderView(definition: ChatUiDefinition, events: ChatEvent[]) {
  const host = stubChatHost({ chatUi: () => definition })
  host.snapshots.set('s1', { providerId: 'opencode', transcript: makeTranscript(events), status: 'idle' })
  const withHost = ({ children }: { children: ReactNode }) =>
    wrapper({ children: <ChatHostProvider value={host}>{children}</ChatHostProvider> })
  render(<ChatSessionView session={makeSession({ providerId: 'opencode' })} active />, { wrapper: withHost })
  await screen.findByTestId(CHAT_TESTIDS.messageList)
}
