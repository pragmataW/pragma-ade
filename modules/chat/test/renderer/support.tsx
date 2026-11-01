import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach } from 'vitest'
import { ChatHostProvider } from '../../src/renderer/host-adapter'
import { useChatStore } from '../../src/renderer/session/store'
import { chatTestI18n, type StubChatHost, stubChatHost } from '../../testing'

afterEach(cleanup)
beforeEach(() => useChatStore.setState({ sessions: {}, appends: {}, activeSessionId: null }))

const i18n = await chatTestI18n(['claude'])

/** Renders inside the English i18n instance and a (stub) `ChatHost`. */
export function renderChat(ui: ReactElement, host: StubChatHost = stubChatHost()) {
  const result = render(
    <I18nextProvider i18n={i18n}>
      <ChatHostProvider value={host}>{ui}</ChatHostProvider>
    </I18nextProvider>,
  )
  return { ...result, host }
}

export { i18n as testI18n }
