import { defineMainModule } from '@pragma/sdk/main'
import { COMMANDS, SHORTCUTS } from '../constants'
import {
  ExampleIpc,
  ExampleItemAdded,
  ExampleServiceToken,
  type ExampleSettings,
  ExampleSettingsSchema,
} from '../contract'
import { registerExampleIpc } from './ipc'
import { createExampleService } from './service'

const APP_SCOPE = 'app'

export default defineMainModule<ExampleSettings>({
  settings: { schema: ExampleSettingsSchema, defaults: ExampleSettingsSchema.parse({}) },
  migrations: true,
  activate(ctx) {
    const service = createExampleService(ctx.db, (e) => {
      ctx.events.emit(ExampleItemAdded, e)
      ctx.ipc.publish(ExampleIpc.itemAdded, e)
    })
    ctx.services.provide(ExampleServiceToken, service)
    registerExampleIpc(ctx, service)
    // `app` scope: matched in the renderer, so editor/browser views keep the chord (§10.2).
    ctx.shortcuts.register({
      ...SHORTCUTS.sayHello,
      scope: APP_SCOPE,
      command: COMMANDS.sayHello,
      titleKey: 'example:commands.sayHello',
    })
  },
})
