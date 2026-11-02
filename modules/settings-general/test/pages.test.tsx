import { join } from 'node:path'
import { ShellSlots } from '@pragma/sdk'
import { Slot, useRendererHost } from '@pragma/sdk/renderer'
import { findRepoRoot, loadModuleRecord } from '@pragma/test-support'
import { type RenderedWithHost, rendererRecordOf, renderWithRendererHost } from '@pragma/test-support/dom'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { type GeneralSettings, SETTINGS_GENERAL_ID, SETTINGS_GENERAL_PAGES, TEST_IDS } from '../src/contract'
import renderer from '../src/renderer/index'

const DIR = join(import.meta.dirname, '..')
const PALETTES = ['vscode', 'dark-brown', 'amber', 'indigo']
let r: RenderedWithHost | undefined

afterEach(async () => {
  await r?.dispose()
  r = undefined
})

/** Renders one registered settings page by id (what the shell's SettingsView does). */
function PageById({ id }: { id: string }) {
  const { registries } = useRendererHost()
  const pages = useSyncExternalStore(registries.store.subscribe, () => registries.store.getState().settingsPages)
  const Page = pages.find((p) => p.id === id)?.component
  return Page ? <Page /> : null
}

async function renderPage(id: string) {
  const main = await loadModuleRecord(DIR)
  const claude = await loadModuleRecord(join(findRepoRoot(), 'providers', 'claude'))
  r = await renderWithRendererHost(
    <>
      <Slot id={ShellSlots.titlebarRight} />
      <PageById id={id} />
    </>,
    { mainModules: [main, claude], records: [rendererRecordOf(main, renderer as never), rendererRecordOf(claude)] },
  )
  return r
}

const stored = () => r?.main.host.settings.get<GeneralSettings>(SETTINGS_GENERAL_ID)

describe('settings-general pages', () => {
  it('registers four pages in the fixed order (no Beta page: chat is out of beta)', async () => {
    const { host } = await renderPage(SETTINGS_GENERAL_PAGES.general)
    expect(host.registries.store.getState().settingsPages.map((p) => [p.id, p.order])).toEqual([
      ['general', 10],
      ['appearance', 20],
      ['modules', 30],
      ['shortcuts', 40],
    ])
    expect(screen.getByTestId(TEST_IDS.languageSelect)).toHaveTextContent('English')
  })

  it('the appearance page shows 4 palettes, 3 modes and 2 densities', async () => {
    await renderPage(SETTINGS_GENERAL_PAGES.appearance)
    for (const id of PALETTES) expect(screen.getByTestId(TEST_IDS.paletteCard(id))).toBeInTheDocument()
    for (const m of ['dark', 'light', 'system']) expect(screen.getByTestId(TEST_IDS.modeOption(m))).toBeInTheDocument()
    for (const d of ['compact', 'comfortable'])
      expect(screen.getByTestId(TEST_IDS.densityOption(d))).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.paletteCard('vscode'))).toHaveAttribute('aria-pressed', 'true')
  })

  it('the palette click updates settings', async () => {
    await renderPage(SETTINGS_GENERAL_PAGES.appearance)
    await userEvent.click(screen.getByTestId(TEST_IDS.paletteCard('indigo')))
    await waitFor(() => expect(stored()?.appearance.palette).toBe('indigo'))
    await waitFor(() =>
      expect(screen.getByTestId(TEST_IDS.paletteCard('indigo'))).toHaveAttribute('aria-pressed', 'true'),
    )
    await userEvent.click(screen.getByTestId(TEST_IDS.modeOption('light')))
    await waitFor(() => expect(r?.host.theme.get().resolved).toBe('light'))
  })

  it('the quick toggle stores the opposite of the resolved mode', async () => {
    await renderPage(SETTINGS_GENERAL_PAGES.appearance)
    expect(r?.host.theme.get().resolved).toBe('dark')
    await userEvent.click(screen.getByTestId(TEST_IDS.quickTheme))
    await waitFor(() => expect(stored()?.appearance.mode).toBe('light'))
  })

  it('the shortcuts page lists core.commandPalette with scope app', async () => {
    const { main } = await renderPage(SETTINGS_GENERAL_PAGES.shortcuts)
    main.host.shortcuts.register({
      id: 'core.commandPalette',
      accelerator: 'CmdOrCtrl+K',
      scope: 'app',
      command: 'core.commandPalette',
      titleKey: 'core:dialogs.confirm',
    })
    const row = await screen.findByTestId(TEST_IDS.shortcutRow('core.commandPalette'))
    expect(row).toHaveTextContent('App')
    expect(row).toHaveTextContent('⌘')
  })

  it('the modules page disables the switch for core modules and shows a restart bar', async () => {
    await renderPage(SETTINGS_GENERAL_PAGES.modules)
    const own = await screen.findByTestId(TEST_IDS.moduleToggle(SETTINGS_GENERAL_ID))
    expect(own).toBeDisabled()
    const claude = screen.getByTestId(TEST_IDS.moduleToggle('claude'))
    expect(claude).toBeEnabled()
    expect(claude).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getByTestId(TEST_IDS.moduleRow('claude'))).getByText('Provider')).toBeInTheDocument()
    expect(screen.queryByTestId(TEST_IDS.restart)).toBeNull()
    await userEvent.click(claude)
    expect(await screen.findByTestId(TEST_IDS.restart)).toBeInTheDocument()
    expect(claude).toHaveAttribute('aria-checked', 'false')
    expect(r?.main.host.settings.get<{ modules: { disabled: string[] } }>('core').modules.disabled).toEqual(['claude'])
  })
})
