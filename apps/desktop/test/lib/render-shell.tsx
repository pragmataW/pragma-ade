import { renderWithRendererHost } from '@pragma/test-support/dom'
import type { ReactElement } from 'react'
import { onTestFinished } from 'vitest'
import { registerShellCommands } from '../../src/renderer/lib/shell-commands'
import { ShellStoreContext } from '../../src/renderer/lib/shell-context'
import { createShellStore } from '../../src/renderer/lib/shell-store'

const CORE_LOCALES = { en: { center: { empty: 'Empty' }, right: { welcome: 'Welcome' }, settings: { back: 'Back' } } }

/** Renders (and disposes after the test) a shell component with a real renderer host (over an in-process main host) and the shell store. */
export async function renderShell(ui: ReactElement) {
  const store = createShellStore()
  const rendered = await renderWithRendererHost(
    <ShellStoreContext.Provider value={store}>{ui}</ShellStoreContext.Provider>,
    {
      coreLocales: CORE_LOCALES,
    },
  )
  registerShellCommands(rendered.host, store)
  onTestFinished(() => rendered.dispose())
  return { ...rendered, store }
}
