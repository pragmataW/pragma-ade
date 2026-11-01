import { defineMainModule } from '@pragma/sdk/main'
import {
  COMMENTS_SETTINGS_DEFAULTS,
  CommentsServiceToken,
  type CommentsSettings,
  CommentsSettingsSchema,
} from '../contract'
import { DeliveryRegistry } from './delivery-registry'
import { registerCommentsIpc } from './ipc'
import { createCommentsRepository } from './repository'
import { getMainService, setMainService } from './runtime'
import { createCommentsService } from './service'
import { createTerminalDelivery } from './terminal-delivery'
import { createUpstream, TERMINAL_MODE } from './upstream'

export default defineMainModule<CommentsSettings>({
  settings: { schema: CommentsSettingsSchema, defaults: COMMENTS_SETTINGS_DEFAULTS },
  migrations: true,
  activate(ctx) {
    const upstream = createUpstream(ctx)
    const service = createCommentsService({
      repo: createCommentsRepository(ctx.db),
      upstream,
      registry: new DeliveryRegistry(),
      events: ctx.events,
      settings: () => CommentsSettingsSchema.parse(ctx.settings.get() ?? {}),
    })
    service.registerDeliveryTarget(TERMINAL_MODE, createTerminalDelivery(upstream))
    ctx.services.provide(CommentsServiceToken, service)
    registerCommentsIpc(ctx.ipc, service)
    setMainService(service)
  },
  deactivate() {
    getMainService().dispose()
    setMainService(undefined)
  },
})
