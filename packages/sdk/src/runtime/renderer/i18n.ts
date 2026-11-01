import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE } from '../../constants'
import { i18nOptions } from '../shared/i18n-options'
import type { I18nResources } from '../shared/i18n-resources'

/** Renderer i18next instance (react-i18next) over the generated resources (§6). */
export function createRendererI18n(opts: {
  resources: I18nResources
  testMode: boolean
  onMissing: (message: string) => void
}): I18nInstance {
  const instance = i18next.createInstance()
  instance.use(initReactI18next)
  void instance.init({
    ...i18nOptions(opts.testMode, opts.onMissing),
    resources: opts.resources.resources,
    ns: Object.keys(opts.resources.resources[DEFAULT_LANGUAGE] ?? {}),
    lng: DEFAULT_LANGUAGE,
    react: { useSuspense: false },
  })
  return instance
}
