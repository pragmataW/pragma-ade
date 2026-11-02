import { CoreIpc } from '@pragma/sdk'
import { RendererHostProvider } from '@pragma/sdk/renderer'
import { createRendererHost, type IpcClient, type PragmaBridge } from '@pragma/sdk/runtime/renderer'
import { type OverlayGuardMode, setOverlayGuardReporter } from '@pragma/ui/lib/overlay-guard'
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

/** One count per guard mode; `core.nativeViews.occlusion` is sent whenever either flag flips. */
function wireOverlayGuard(ipc: IpcClient): void {
  const counts: Record<OverlayGuardMode, number> = { hide: 0, snapshot: 0 }
  let last = { hide: false, snapshot: false }
  setOverlayGuardReporter((delta, mode) => {
    counts[mode] += delta
    const next = { hide: counts.hide > 0, snapshot: counts.snapshot > 0 }
    if (next.hide === last.hide && next.snapshot === last.snapshot) return
    last = next
    void ipc.invoke(CoreIpc.nativeViewsOcclusion, next)
  })
}

async function boot(): Promise<void> {
  const host = await createRendererHost({ records: rendererModules, coreLocales, bridge: window.pragma })
  wireOverlayGuard(host.ipc)
  applyTheme(document.documentElement, host.theme.get())
  host.theme.onChange((s) => applyTheme(document.documentElement, s))
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
