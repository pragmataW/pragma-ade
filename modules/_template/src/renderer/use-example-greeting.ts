import { useLatestAsync, useModuleSettings, useRendererContext } from '@pragma/sdk/renderer'
import { ExampleIpc, type ExampleSettings } from '../contract'

/** Component logic lives in hooks: the greeting for the configured name, reloaded when it changes. */
export function useExampleGreeting(): string | undefined {
  const ctx = useRendererContext<ExampleSettings>()
  const { name } = useModuleSettings<ExampleSettings>()
  return useLatestAsync(() => ctx.ipc.invoke(ExampleIpc.hello, { name }), [ctx, name]).data?.text
}
