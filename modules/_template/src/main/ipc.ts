import type { MainContext } from '@pragma/sdk/main'
import { ExampleIpc, type ExampleService, type ExampleSettings } from '../contract'
import { formatGreeting } from '../lib/greeting'

/** IPC handlers; inputs and outputs are validated against the contract by the router. */
export function registerExampleIpc(ctx: MainContext<ExampleSettings>, service: ExampleService): void {
  ctx.ipc.handle(ExampleIpc.hello, ({ name }) => ({
    text: ctx.i18n.t('example:greeting', { name: formatGreeting(name ?? ctx.settings.get().name) }),
  }))
  ctx.ipc.handle(ExampleIpc.addItem, ({ label }) => service.add(label))
  ctx.ipc.handle(ExampleIpc.countItems, () => ({ count: service.count() }))
}
