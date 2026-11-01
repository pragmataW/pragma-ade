import i18next, { type TOptions } from 'i18next'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'
import { DEFAULT_LANGUAGE } from '../../constants'
import { i18nOptions } from '../shared/i18n-options'
import type { I18nResources } from '../shared/i18n-resources'

const LANGUAGE_CHANGED_EVENT = 'languageChanged'

export interface MainI18n {
  t(key: string, options?: TOptions): string
  language(): string
  languages: string[]
  changeLanguage(lng: string): Promise<void>
  onLanguageChanged(cb: (lng: string) => void): Disposable
}

/** Main-process i18next instance over the same resources as the renderer (§6). */
export function createMainI18n(opts: {
  resources: I18nResources
  language?: string
  testMode: boolean
  log: Logger
}): MainI18n {
  const instance = i18next.createInstance()
  void instance.init({
    ...i18nOptions(opts.testMode, (m) => opts.log.warn(m)),
    resources: opts.resources.resources,
    ns: Object.keys(opts.resources.resources[DEFAULT_LANGUAGE] ?? {}),
    lng: opts.language ?? DEFAULT_LANGUAGE,
  })
  return {
    t: (key, options) => instance.t(key, options ?? {}),
    language: () => instance.language,
    languages: opts.resources.languages,
    async changeLanguage(lng) {
      await instance.changeLanguage(lng)
    },
    onLanguageChanged(cb) {
      instance.on(LANGUAGE_CHANGED_EVENT, cb)
      return toDisposable(() => instance.off(LANGUAGE_CHANGED_EVENT, cb))
    },
  }
}
