import { defineMainModule } from '@pragma/sdk/main'
import { ChatServiceToken, type ChatSettings, chatSettingsDefaults, chatSettingsSchema } from '../contract'
import { activateChat, type ChatMain } from './activate'
import { createAgentsApi } from './agents-adapter'
import { setChatRuntime } from './runtime'

let main: ChatMain | undefined

export default defineMainModule<ChatSettings>({
  settings: { schema: chatSettingsSchema, defaults: chatSettingsDefaults },
  activate(ctx) {
    main = activateChat({
      agents: createAgentsApi(ctx),
      capability: (providerId) => ctx.providers.capability(providerId, 'chat'),
      settings: () => ctx.settings.get(),
      ipc: ctx.ipc,
      provideService: (service) => ctx.services.provide(ChatServiceToken, service),
      log: ctx.log,
    })
    setChatRuntime({ registry: main.registry })
  },
  async deactivate() {
    await main?.dispose()
    main = undefined
    setChatRuntime(undefined)
  },
})
