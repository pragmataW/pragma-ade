import { ShellTestIds as T } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'

export interface PragmaTestApi {
  registerRightTab(t: { id: string; titleKey: string; order: number }): void
  rightTabIds(): string[]
  execute(id: string, args?: unknown): Promise<unknown>
}

export type PragmaTestWindow = Window & { __pragmaTest: PragmaTestApi }

const TEST_TAB_ICON = 'flask-conical'

function TestTabBody({ tabId, titleKey }: { tabId: string; titleKey: string }) {
  const t = useT()
  return <div data-testid={T.testTabBody(tabId)}>{t(titleKey)}</div>
}

/** `window.__pragmaTest` (test mode only): lets E2E register tabs and run commands without a module. */
export function installTestApi(host: RendererHost): void {
  const api: PragmaTestApi = {
    registerRightTab({ id, titleKey, order }) {
      host.registries.registerRightTab({
        id,
        titleKey,
        order,
        icon: TEST_TAB_ICON,
        component: ({ tabId }) => <TestTabBody tabId={tabId} titleKey={titleKey} />,
      })
    },
    rightTabIds: () => host.registries.store.getState().tabs.map((t) => t.id),
    execute: (id, args) => host.commands.execute(id, args),
  }
  ;(window as unknown as PragmaTestWindow).__pragmaTest = api
}
