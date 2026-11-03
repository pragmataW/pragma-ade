import { cleanup, render } from '@testing-library/react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach } from 'vitest'
import type { ChatEvent, ChatItem, ChatPartProps } from '../../src/contract'
import { ChatHostProvider } from '../../src/renderer/host-adapter'
import { defaultChatUi } from '../../src/renderer/kit/default-ui'
import { ChatPartsProvider } from '../../src/renderer/kit/parts/ChatRows'
import { resetTasksPanels } from '../../src/renderer/kit/tasks/store'
import { resetComposerDrafts } from '../../src/renderer/session/drafts'
import { useChatStore } from '../../src/renderer/session/store'
import { chatTestI18n, installJsdomLayout, type StubChatHost, stubChatHost, stubSessionApi } from '../../testing'

afterEach(cleanup)

installJsdomLayout()
beforeEach(() => {
  useChatStore.setState({ sessions: {}, inboxVersions: {}, activeSessionId: null })
  resetTasksPanels()
  resetComposerDrafts()
})

const i18n = await chatTestI18n(['claude'])

/** Renders inside the English i18n instance and a (stub) `ChatHost`. */
export function renderChat(ui: ReactElement, host: StubChatHost = stubChatHost()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <ChatHostProvider value={host}>{children}</ChatHostProvider>
    </I18nextProvider>
  )
  const result = render(ui, { wrapper })
  return { ...result, host }
}

export { i18n as testI18n }

/**
 * Renders one item of the transcript built from `events` with `Part` (the first item, or the first of `kind`),
 * inside the default kit parts (nested transcripts render).
 */
export function renderPart(
  Part: ComponentType<ChatPartProps<never>>,
  events: ChatEvent[],
  opts: { host?: StubChatHost; kind?: ChatItem['kind'] } = {},
) {
  const s = stubSessionApi(events)
  const P = Part as ComponentType<ChatPartProps<ChatItem>>
  const items = s.api.transcript.items
  const item = (opts.kind ? items.find((i) => i.kind === opts.kind) : items[0]) as ChatItem
  const ui = (
    <ChatPartsProvider value={{ parts: defaultChatUi.parts, groupToolCalls: true }}>
      <P item={item} session={s.api} />
    </ChatPartsProvider>
  )
  return { ...renderChat(ui, opts.host), ...s }
}
