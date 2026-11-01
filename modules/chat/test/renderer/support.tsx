import { cleanup, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach } from 'vitest'
import { ChatHostProvider } from '../../src/renderer/host-adapter'
import { useChatStore } from '../../src/renderer/session/store'
import { chatTestI18n, type StubChatHost, stubChatHost } from '../../testing'

afterEach(cleanup)

/** jsdom has no layout: give every element a viewport-sized box so the virtualized list renders a window. */
const BOX = { width: 740, height: 800 }
for (const [prop, value] of [
  ['offsetWidth', BOX.width],
  ['offsetHeight', BOX.height],
  ['clientHeight', BOX.height],
] as const)
  Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value })
beforeEach(() => useChatStore.setState({ sessions: {}, appends: {}, activeSessionId: null }))

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
