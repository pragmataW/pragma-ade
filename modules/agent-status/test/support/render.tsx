import { cleanup, render } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach } from 'vitest'
import en from '../../locales/en.json'
import { useAgentStatusStore } from '../../src/renderer/store'

afterEach(cleanup)
beforeEach(() => useAgentStatusStore.setState({ sessions: {}, worktrees: {} }))

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { 'agent-status': en } },
  interpolation: { escapeValue: false },
})

/** Renders with the English `agent-status` namespace; the status store is reset before each test. */
export const renderStatus = (ui: ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
