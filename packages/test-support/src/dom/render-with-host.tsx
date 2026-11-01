import { RendererHostProvider } from '@pragma/sdk/renderer'
import type { ModuleRecord } from '@pragma/sdk/runtime/main'
import { createRendererHost, type RendererHost, type RendererModuleRecord } from '@pragma/sdk/runtime/renderer'
import { act, type RenderResult, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { FakePlatform } from '../node/fake-platform'
import { createTestModuleHost, type TestModuleHost } from '../node/test-host'

export interface RenderedWithHost extends RenderResult {
  host: RendererHost
  main: TestModuleHost
  dispose(): Promise<void>
}

/** A real main host (in-process) plus a renderer host over the in-memory bridge, rendering `ui` inside it. */
export async function renderWithRendererHost(
  ui: ReactElement,
  opts: {
    records?: RendererModuleRecord[]
    mainModules?: ModuleRecord[]
    platform?: FakePlatform
    coreLocales?: Record<string, object>
  } = {},
): Promise<RenderedWithHost> {
  const main = await createTestModuleHost({ modules: opts.mainModules ?? [], platform: opts.platform })
  const host = await createRendererHost({
    records: opts.records ?? [],
    coreLocales: (opts.coreLocales ?? {}) as Record<string, Record<string, unknown>>,
    bridge: main.bridge,
    log: main.log,
  })
  let result: RenderResult | undefined
  await act(async () => {
    result = render(<RendererHostProvider host={host}>{ui}</RendererHostProvider>)
  })
  const rendered = result as RenderResult
  return {
    ...rendered,
    host,
    main,
    async dispose() {
      rendered.unmount()
      host.dispose()
      await main.dispose()
    },
  }
}
