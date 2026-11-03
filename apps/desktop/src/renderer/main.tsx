import { CoreIpc } from '@pragma/sdk'
import { RendererHostProvider } from '@pragma/sdk/renderer'
import { createRendererHost, type IpcClient, type PragmaBridge } from '@pragma/sdk/runtime/renderer'
import { setOverlayGuardReporter } from '@pragma/ui/lib/overlay-guard'
import { createRoot } from 'react-dom/client'
import { coreLocales, rendererModules } from '../generated/modules.renderer'
import { applyTheme } from './lib/apply-theme'
import { readDockLayout } from './lib/dock-layout'
import { registerShellCommands } from './lib/shell-commands'
import { ShellStoreContext } from './lib/shell-context'
import { createShellStore } from './lib/shell-store'
import { installTestApi } from './lib/test-api'
import { Shell } from './shell/Shell'
import './styles.css'

declare global {
  interface Window {
    pragma: PragmaBridge
  }
}

const ROOT_ID = 'root'

/**
 * Sends every open overlay's cover to main, which swaps only the native views they intersect for snapshots. Setting
 * the reporter sends the current (empty) list at once: a reloaded renderer starts with no overlays, while main may
 * still hold the old page's covers.
 */
function wireOverlayGuard(ipc: IpcClient): void {
  setOverlayGuardReporter((covers) => void ipc.invoke(CoreIpc.nativeViewsOcclusion, { covers }))
}

async function boot(): Promise<void> {
  const host = await createRendererHost({ records: rendererModules, coreLocales, bridge: window.pragma })
  wireOverlayGuard(host.ipc)
  const { platform } = host.appInfo
  applyTheme(document.documentElement, host.theme.get(), platform)
  host.theme.onChange((s) => applyTheme(document.documentElement, s, platform))
  const store = createShellStore(readDockLayout(host.layout))
  registerShellCommands(host, store)
  if (host.appInfo.testMode) installTestApi(host)
  createRoot(document.getElementById(ROOT_ID) as HTMLElement).render(
    <RendererHostProvider host={host}>
      <ShellStoreContext.Provider value={store}>
        <Shell />
      </ShellStoreContext.Provider>
    </RendererHostProvider>,
  )
  await host.ipc.invoke(CoreIpc.appRendererReady, undefined)
}

void boot()
