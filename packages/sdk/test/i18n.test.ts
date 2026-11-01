import { expect, test } from 'vitest'
import { createMainI18n } from '../src/runtime/main/i18n'
import { buildI18nResources } from '../src/runtime/shared/i18n-resources'
import { memoryLogger } from './lib/builders'

const core = { en: { app: { title: 'Pragma ADE' } }, de: { app: { title: 'Pragma DE' } } }
const records = [
  {
    id: 'demo',
    locales: { en: { tab: { title: 'Demo', items_one: '{{count}} item', items_other: '{{count}} items' } } },
  },
]
const make = (testMode = false, language?: string) => {
  const log = memoryLogger()
  const i18n = createMainI18n({ resources: buildI18nResources(records, core), language, testMode, log })
  return { i18n, log }
}

test('namespaced keys resolve', () => {
  const { i18n } = make()
  expect(i18n.t('core:app.title')).toBe('Pragma ADE')
  expect(i18n.t('demo:tab.title')).toBe('Demo')
})
test('falls back to en for de', async () => {
  const { i18n } = make(false, 'de')
  expect(i18n.t('core:app.title')).toBe('Pragma DE')
  expect(i18n.t('demo:tab.title')).toBe('Demo')
})
test('languages come from core with en first', () => {
  expect(buildI18nResources(records, { de: {}, en: {} }).languages).toEqual(['en', 'de'])
  expect(make().i18n.languages).toEqual(['en', 'de'])
})
test('[i18n-missing] is logged in test mode', () => {
  const { i18n, log } = make(true)
  i18n.t('demo:nope.key')
  expect(log.messages('warn').some((m) => m.startsWith('[i18n-missing]') && m.includes('demo:nope.key'))).toBe(true)
})
test('plurals', () => {
  const { i18n } = make()
  expect(i18n.t('demo:tab.items', { count: 1 })).toBe('1 item')
  expect(i18n.t('demo:tab.items', { count: 3 })).toBe('3 items')
})
test('changeLanguage notifies', async () => {
  const { i18n } = make()
  const seen: string[] = []
  i18n.onLanguageChanged((l) => seen.push(l))
  await i18n.changeLanguage('de')
  expect(i18n.language()).toBe('de')
  expect(seen).toEqual(['de'])
})
