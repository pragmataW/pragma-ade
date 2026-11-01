import { CoreCommands, SETTINGS_PAGE_ORDER, ShellTestIds as T } from '@pragma/sdk'
import { act, fireEvent, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SettingsView } from '../src/renderer/shell/SettingsView'
import { renderShell } from './lib/render-shell'

const setup = async () => {
  const r = await renderShell(<SettingsView />)
  const page = (id: keyof typeof SETTINGS_PAGE_ORDER) =>
    r.host.registries.registerSettingsPage({
      id,
      titleKey: `core:${id}`,
      order: SETTINGS_PAGE_ORDER[id],
      component: () => <p>{`page-${id}`}</p>,
    })
  act(() => {
    page('modules')
    page('general')
    page('appearance')
  })
  return r
}

test('nav lists pages by SETTINGS_PAGE_ORDER and renders the selected page', async () => {
  await setup()
  const nav = screen.getAllByTestId(/^settings-nav-/).map((el) => el.getAttribute('data-testid'))
  expect(nav).toEqual([T.settingsNav('general'), T.settingsNav('appearance'), T.settingsNav('modules')])
  expect(screen.getByTestId(T.settingsPage('general'))).toHaveTextContent('page-general')
  fireEvent.click(screen.getByTestId(T.settingsNav('modules')))
  expect(screen.getByTestId(T.settingsPage('modules'))).toHaveTextContent('page-modules')
})
test('core.openSettings with pageId opens that page', async () => {
  const r = await setup()
  await act(() => r.host.commands.execute(CoreCommands.openSettings, { pageId: 'appearance' }))
  expect(r.store.getState()).toMatchObject({ settingsOpen: true, settingsPage: 'appearance' })
  expect(screen.getByTestId(T.settingsPage('appearance'))).toBeInTheDocument()
})
