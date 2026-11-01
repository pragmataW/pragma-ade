import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach } from 'vitest'

afterEach(cleanup)

const LOCALE = join(import.meta.dirname, '..', '..', 'locales', 'en.json')
/** The English `comments` namespace (assert visible texts with it). */
export const en = JSON.parse(readFileSync(LOCALE, 'utf8'))

const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({ lng: 'en', ns: ['comments'], resources: { en: { comments: en } } })

/** Renders inside an i18next provider holding only the comments namespace. */
export const renderUi = (ui: ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
