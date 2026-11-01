import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import i18next, { type i18n } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach } from 'vitest'

afterEach(cleanup)

const ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const providerNamespace = (id: string) => {
  const dir = join(ROOT, 'providers', id, 'locales', 'en')
  return Object.assign({}, ...readdirSync(dir).map((f) => readJson(join(dir, f))))
}

/** An i18next instance with the agents namespace and the three providers' namespaces (English). */
export async function testI18n(): Promise<i18n> {
  const instance = i18next.createInstance()
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: {
      en: {
        agents: readJson(join(ROOT, 'modules', 'agents', 'locales', 'en.json')),
        claude: providerNamespace('claude'),
        opencode: providerNamespace('opencode'),
        custom: providerNamespace('custom'),
      },
    },
    interpolation: { escapeValue: false },
  })
  return instance
}

export async function renderWithI18n(ui: ReactElement) {
  const instance = await testI18n()
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>)
}
