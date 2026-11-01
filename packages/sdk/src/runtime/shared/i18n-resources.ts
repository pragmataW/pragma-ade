import { CORE_MODULE_ID, DEFAULT_LANGUAGE } from '../../constants'

export type LocaleTree = Record<string, unknown>
export type I18nResourceMap = Record<string, Record<string, LocaleTree>>

export interface I18nResources {
  resources: I18nResourceMap
  /** From the `core` locales, `en` first. */
  languages: string[]
}

export function buildI18nResources(
  records: readonly { id: string; locales: Record<string, LocaleTree> }[],
  coreLocales: Record<string, LocaleTree>,
): I18nResources {
  const resources: I18nResourceMap = {}
  const add = (lng: string, ns: string, tree: LocaleTree): void => {
    resources[lng] = { ...resources[lng], [ns]: tree }
  }
  for (const [lng, tree] of Object.entries(coreLocales)) add(lng, CORE_MODULE_ID, tree)
  for (const r of records) for (const [lng, tree] of Object.entries(r.locales)) add(lng, r.id, tree)
  const others = Object.keys(coreLocales).filter((l) => l !== DEFAULT_LANGUAGE)
  return { resources, languages: [DEFAULT_LANGUAGE, ...others.sort()] }
}
