import type { InitOptions } from 'i18next'
import { CORE_MODULE_ID, DEFAULT_LANGUAGE } from '../../constants'

export const I18N_MISSING_PREFIX = '[i18n-missing]'

/** Shared i18next options for main and renderer; test mode reports missing keys. */
export function i18nOptions(testMode: boolean, onMissing: (message: string) => void): InitOptions {
  return {
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: CORE_MODULE_ID,
    nsSeparator: ':',
    keySeparator: '.',
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
    saveMissing: testMode,
    missingKeyHandler: testMode ? (_lngs, ns, key) => onMissing(`${I18N_MISSING_PREFIX} ${ns}:${key}`) : undefined,
  }
}
