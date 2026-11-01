import { CoreIpc, ShellTestIds } from '@pragma/sdk'
import { RendererHostProvider } from '@pragma/sdk/renderer'
import { createRendererHost, type PragmaBridge } from '@pragma/sdk/runtime/renderer'
import { createRoot } from 'react-dom/client'
import { coreLocales, rendererModules } from '../generated/modules.renderer'
import './styles.css'

declare global {
  interface Window {
    pragma: PragmaBridge
  }
}

const ROOT_ID = 'root'

async function boot(): Promise<void> {
  const host = await createRendererHost({ records: rendererModules, coreLocales, bridge: window.pragma })
  createRoot(document.getElementById(ROOT_ID) as HTMLElement).render(
    <RendererHostProvider host={host}>
      <div data-testid={ShellTestIds.shellReady} />
    </RendererHostProvider>,
  )
  await host.ipc.invoke(CoreIpc.appRendererReady, undefined)
}

void boot()
