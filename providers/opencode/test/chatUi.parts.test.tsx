import type { ChatEvent, ChatItem } from '@pragma/module-chat/contract'
import {
  chatTestI18n,
  installJsdomLayout,
  makeTranscript,
  type StubChatHost,
  stubChatHost,
  stubSessionApi,
} from '@pragma/module-chat/testing'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { OPENCODE_CHAT_TESTIDS as IDS } from '../src/renderer/chat/constants'
import { ChatHostProvider } from '../src/renderer/chat/kit'
import { NoticeRow } from '../src/renderer/chat/NoticeRow'
import { OpencodeErrorRow } from '../src/renderer/chat/OpencodeErrorRow'
import { OpencodeModelPicker } from '../src/renderer/chat/OpencodeModelPicker'
import { OpencodeUserMessage } from '../src/renderer/chat/OpencodeUserMessage'
import { CUSTOM } from '../src/renderer/chat/payloads'
import { ProvidersPage } from '../src/renderer/chat/settings/ProvidersPage'

afterEach(cleanup)
installJsdomLayout()
// cmdk scrolls the active item into view (jsdom has no layout)
Element.prototype.scrollIntoView ??= () => undefined

const i18n = await chatTestI18n(['opencode'])
/** A host whose shell offers commands; `executed` records them. */
function commandHost() {
  const executed: unknown[] = []
  const host = stubChatHost({
    commands: {
      has: () => true,
      execute: async (id, args) => void executed.push([id, args]),
      onChange: () => ({ dispose: () => undefined }),
    },
  })
  return { host, executed }
}
const OPEN_PAGE = ['core.openSettings', { pageId: 'chat.provider.opencode' }]

/** `ui` inside the OpenCode English locale and a (stub) chat host. */
function renderUi(ui: ReactElement, host: StubChatHost = stubChatHost()) {
  const tree = (
    <I18nextProvider i18n={i18n}>
      <ChatHostProvider value={host}>{ui}</ChatHostProvider>
    </I18nextProvider>
  )
  return { ...render(tree), host, user: userEvent.setup() }
}

const itemOf = <K extends ChatItem['kind']>(events: ChatEvent[], kind: K) => {
  const item = makeTranscript(events).items.find((i) => i.kind === kind)
  if (!item || item.kind !== kind) throw new Error(`no ${kind}`)
  return item as Extract<ChatItem, { kind: K }>
}

const models: ChatEvent = {
  kind: 'options',
  options: [
    {
      key: 'model',
      type: 'enum',
      labelKey: 'chat:option.model',
      default: 'a/one',
      current: 'a/one',
      values: [
        {
          value: 'b/gpt',
          label: 'GPT',
          description: 'Broken',
          descriptionKey: 'opencode:chat.model.reauth',
          warn: true,
        },
        { value: 'a/one', label: 'One', description: 'Alpha' },
        { value: 'l/llama', label: 'Llama', description: 'Local', descriptionKey: 'opencode:chat.model.local' },
      ],
    },
  ],
}

describe('OpencodeModelPicker', () => {
  it('groups models by provider with hints, picks one, links to the provider page', async () => {
    const s = stubSessionApi([models])
    const { host, executed } = commandHost()
    const { user } = renderUi(<OpencodeModelPicker session={s.api} />, host)
    await user.click(screen.getByTestId(IDS.modelPicker))
    expect(screen.getByText('Broken')).toBeInTheDocument()
    expect(screen.getByText(/Sign-in expired/)).toBeInTheDocument()
    expect(screen.getByText(/small context window/)).toBeInTheDocument()
    await user.click(screen.getByTestId(IDS.modelOption('l/llama')))
    expect(s.callsOf('setOption')[0]?.args).toEqual(['model', 'l/llama'])
    await user.click(screen.getByTestId(IDS.modelPicker))
    await user.click(screen.getByTestId(IDS.manageProviders))
    expect(executed).toEqual([OPEN_PAGE])
  })
})

describe('NoticeRow', () => {
  it.each([
    [{ notice: 'reverted', messageId: 'm', files: ['a.ts', 'b.ts'] }, /Rewound.*restored 2 files: a.ts, b.ts/],
    [{ notice: 'forked', from: 'ses_1', to: 'ses_2' }, /Continuing in a copy.*ses_1/],
  ])('%j', (data, text) => {
    const item = itemOf([{ kind: 'custom', type: CUSTOM.notice, data }], 'custom')
    renderUi(<NoticeRow item={item} session={stubSessionApi().api} />)
    expect(screen.getByTestId(IDS.notice).textContent).toMatch(text)
  })
})

describe('OpencodeUserMessage', () => {
  const message: ChatEvent = {
    kind: 'message',
    messageId: 'm1',
    role: 'user',
    text: 'hello',
    attachments: [],
    origin: 'live',
  }
  it('rewind asks first, then runs the action; fork runs at once; hidden without the actions', async () => {
    const info: ChatEvent = { kind: 'session-info', actions: ['rewind', 'fork'] }
    const s = stubSessionApi([info, message])
    const { user, host } = renderUi(<OpencodeUserMessage item={itemOf([message], 'message')} session={s.api} />)
    await user.click(screen.getByTestId(IDS.rewind))
    await waitFor(() => expect(s.callsOf('action')[0]?.args).toEqual([{ action: 'rewind', messageId: 'm1' }]))
    expect(host.calls.some((c) => c.method === 'confirm')).toBe(true)
    await user.click(screen.getByTestId(IDS.fork))
    expect(s.callsOf('action')[1]?.args).toEqual([{ action: 'fork', messageId: 'm1' }])
    cleanup()
    renderUi(<OpencodeUserMessage item={itemOf([message], 'message')} session={stubSessionApi([message]).api} />)
    expect(screen.queryByTestId(IDS.rewind)).toBeNull()
  })
})

describe('OpencodeErrorRow', () => {
  it('an auth error offers to reconnect in Settings › OpenCode', async () => {
    const error: ChatEvent = { kind: 'error', code: 'auth', message: 'Invalid API key', fatal: false }
    const { host, executed } = commandHost()
    const { user } = renderUi(<OpencodeErrorRow item={itemOf([error], 'error')} session={stubSessionApi().api} />, host)
    await user.click(screen.getByRole('button', { name: 'Reconnect…' }))
    expect(executed).toEqual([OPEN_PAGE])
  })
})

describe('ProvidersPage', () => {
  const list = {
    providers: [
      {
        id: 'anthropic',
        name: 'Anthropic',
        credentials: [],
        env: [],
        key: true,
        oauth: [],
        free: false,
        notice: 'keyOnly',
      },
      {
        id: 'fake',
        name: 'Fake',
        credentials: [{ id: 'cred_1', label: 'API key', method: 'key' }],
        env: [],
        key: true,
        oauth: [],
        free: false,
      },
      {
        id: 'gh',
        name: 'GitHub Copilot',
        credentials: [],
        env: [],
        key: false,
        oauth: [{ id: 'device', label: 'Login' }],
        free: false,
      },
    ],
  }
  function page(over: (r: { op: string }) => unknown = () => ({ ok: true })) {
    const requests: { op: string }[] = []
    const call = async (r: unknown) => {
      const req = r as { op: string }
      requests.push(req)
      if (req.op === 'list') return list
      if (req.op === 'oauthStart')
        return { attemptID: 'att_1', url: 'https://x.test', instructions: 'Code AB-12', mode: 'code' }
      return over(req)
    }
    return { requests, ...renderUi(<ProvidersPage providerId="opencode" call={call} />) }
  }

  it('connected first, the Anthropic key-only notice, key connect and remove', async () => {
    const { user, requests } = page()
    await screen.findByTestId(IDS.providerRow('fake'))
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText(/Claude Pro\/Max subscriptions are not allowed/)).toBeInTheDocument()
    await user.click(screen.getByTestId(IDS.providerConnect('anthropic')))
    await user.type(screen.getByTestId(IDS.providerKey), 'sk-ant')
    await user.click(screen.getByTestId(IDS.providerKeySave))
    await user.click(screen.getByTestId(IDS.providerRemove('cred_1')))
    await waitFor(() => expect(requests.map((r) => r.op)).toEqual(['list', 'connectKey', 'list', 'remove', 'list']))
    expect(requests[1]).toMatchObject({ integrationID: 'anthropic', key: 'sk-ant' })
  })

  it('sign-in opens the browser through the host; a code flow completes with the pasted code', async () => {
    const { user, requests, host } = page()
    await user.click(await screen.findByTestId(IDS.providerConnect('gh')))
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByTestId(IDS.providerOauth)).toHaveTextContent('Code AB-12')
    expect(host.calls.find((c) => c.method === 'openExternal')?.args).toEqual(['https://x.test'])
    await user.type(screen.getByLabelText('Paste the code'), 'AB-12')
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(requests.map((r) => r.op)).toContain('oauthComplete'))
  })

  it('a failed key shows the error; search filters', async () => {
    const { user } = page(() => {
      throw new Error("Error invoking remote method 'chat.providerCall': Error: Invalid API key")
    })
    await user.click(await screen.findByTestId(IDS.providerConnect('anthropic')))
    await user.type(screen.getByTestId(IDS.providerKey), 'bad')
    await user.click(screen.getByTestId(IDS.providerKeySave))
    expect(await screen.findByTestId(IDS.providerError)).toHaveTextContent(/^Invalid API key$/)
    await user.type(screen.getByTestId(IDS.providerSearch), 'git')
    expect(screen.queryByTestId(IDS.providerRow('fake'))).toBeNull()
    expect(screen.getByTestId(IDS.providerRow('gh'))).toBeInTheDocument()
  })
})
