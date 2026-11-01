import i18next from 'i18next'
import { expect, test } from 'vitest'
import en from '../../locales/en.json'
import { tabLabel, tabStatus } from '../../src/renderer/panel/labels'
import { pane, tab } from '../support/factories'

const i18n = i18next.createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { terminal: en } },
  initAsync: false,
  interpolation: { escapeValue: false },
})
const t = i18n.t.bind(i18n)

test.each([
  [tab({ ordinal: 2, customTitle: null }), 'Terminal 2'],
  [tab({ customTitle: 'build' }), 'build'],
])('tabLabel → %s', (input, label) => expect(tabLabel(input, t)).toBe(label))

test.each([
  [{ exitCode: 3, signal: null, reason: 'exited' }, 'Exited (code 3)'],
  [{ exitCode: null, signal: 9, reason: 'exited' }, 'Exited (signal 9)'],
  [{ exitCode: null, signal: null, reason: 'daemon-restarted' }, 'Session ended — terminal service restarted'],
] as const)('tabStatus %o → %s', (exit, text) =>
  expect(tabStatus(tab({ panes: [pane(), pane({ exit })] }), t)).toBe(text),
)

test('tabStatus is null while every pane runs', () => expect(tabStatus(tab(), t)).toBeNull())
