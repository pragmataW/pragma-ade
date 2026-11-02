import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'
import { CLI_IPC, CLI_TESTIDS, type CliIntegrationStatus } from '../../src/contract'
import { CliSettingsPage } from '../../src/renderer/CliSettingsPage'
import { setCliRuntime } from '../../src/renderer/runtime'

const en = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'locales', 'en.json'), 'utf8'))
const i18n = i18next.createInstance()
void i18n
  .use(initReactI18next)
  .init({ lng: 'en', ns: ['cli-integration'], resources: { en: { 'cli-integration': en } } })

afterEach(() => {
  cleanup()
  setCliRuntime(undefined)
})

const FOREIGN_DIR = '/h/.claude/skills/pragma-handoff'
const status: CliIntegrationStatus = {
  cli: {
    shimPath: '/ud/bin/pragma',
    bundleFound: true,
    installDir: '/h/.local/bin',
    linkPath: '/h/.local/bin/pragma',
    state: 'not_installed',
    dirOnPath: false,
  },
  skills: [
    {
      providerId: 'claude',
      providerDisplayNameKey: 'claude:module.name',
      skillId: 'handoff',
      dir: FOREIGN_DIR,
      state: 'foreign',
    },
    {
      providerId: 'claude',
      providerDisplayNameKey: 'claude:module.name',
      skillId: 'pragma-cli',
      dir: '/h/.claude/skills/pragma-cli',
      state: 'missing',
    },
  ],
}

async function renderPage() {
  const invoke = vi.fn(async (_c: IpcContract<unknown, unknown>, _input: unknown) => status)
  const subscribe = vi.fn((_c: IpcEventContract<unknown>, _cb: unknown) => ({ dispose: () => undefined }))
  setCliRuntime({ ctx: { ipc: { invoke, subscribe } as never } })
  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <CliSettingsPage />
      </I18nextProvider>,
    )
  })
  return { invoke, channels: () => invoke.mock.calls.map(([c]) => c.channel) }
}

it('renders statuses and opens consent dialog listing dirs before installing', async () => {
  const r = await renderPage()
  expect(screen.getByTestId(CLI_TESTIDS.status)).toHaveTextContent(en.settings.cli.status.notInstalled)
  expect(screen.getByTestId(CLI_TESTIDS.notOnPath)).toBeInTheDocument()
  expect(screen.getByTestId(CLI_TESTIDS.skillState('claude', 'handoff'))).toHaveTextContent(
    en.settings.skills.state.foreign,
  )
  fireEvent.click(screen.getByTestId(CLI_TESTIDS.skillsInstallButton))
  const dialog = screen.getByTestId(CLI_TESTIDS.skillsDialog)
  expect(
    within(dialog)
      .getAllByTestId(CLI_TESTIDS.skillsDialogDir)
      .map((e) => e.textContent),
  ).toContain(FOREIGN_DIR)
  expect(dialog).toHaveTextContent(en.dialog.skills.replaces)
  expect(r.channels()).not.toContain(CLI_IPC.installSkills)
  await act(async () => fireEvent.click(screen.getByTestId(CLI_TESTIDS.skillsConfirmButton)))
  expect(r.invoke).toHaveBeenLastCalledWith(expect.objectContaining({ channel: CLI_IPC.installSkills }), {
    providerIds: ['claude'],
  })
})

it('installs the CLI into a typed folder', async () => {
  const r = await renderPage()
  fireEvent.change(screen.getByTestId(CLI_TESTIDS.installDirInput), { target: { value: ' /opt/bin ' } })
  await act(async () => fireEvent.click(screen.getByTestId(CLI_TESTIDS.installButton)))
  expect(r.invoke).toHaveBeenLastCalledWith(expect.objectContaining({ channel: CLI_IPC.installCli }), {
    dir: '/opt/bin',
  })
})
