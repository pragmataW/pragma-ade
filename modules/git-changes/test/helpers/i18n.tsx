import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach } from 'vitest'

const NAMESPACE = 'git-changes'
/** The module's English strings (assert visible text against them). */
export const EN = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'locales', 'en.json'), 'utf8'))

const i18n = createInstance()
void i18n.use(initReactI18next).init({ lng: 'en', ns: [NAMESPACE], resources: { en: { [NAMESPACE]: EN } } })

afterEach(cleanup)

/** Renders with only the git-changes namespace loaded (no renderer host). */
export const renderWithStrings = (ui: ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
