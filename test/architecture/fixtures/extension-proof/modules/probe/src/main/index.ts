import { readFileSync } from 'node:fs'
import { count, integer, sqliteTable } from '@pragma/sdk/db'
import { defineMainModule } from '@pragma/sdk/main'
import { BUILD_MARKER, PING_CAPABILITY, PROBE_BADGE_COUNT, PROBE_ID } from '../constants'
import { ProbeIpc, type ProbeSettings, ProbeSettingsSchema } from '../contract'

const UTF8 = 'utf8'
const probeItems = sqliteTable('probe_items', { id: integer('id').primaryKey() })

/** A file-only module: settings, migrations, IPC, providers, resources and publish, with no core edits. */
export default defineMainModule<ProbeSettings>({
  settings: { schema: ProbeSettingsSchema, defaults: ProbeSettingsSchema.parse({}) },
  migrations: true,
  activate(ctx) {
    ctx.ipc.handle(ProbeIpc.ping, ({ msg }) => ({ pong: `${msg}:${ctx.settings.get().greeting}` }))
    ctx.ipc.handle(ProbeIpc.countItems, () => ({ count: ctx.db.select({ n: count() }).from(probeItems).get()?.n ?? 0 }))
    ctx.ipc.handle(ProbeIpc.providerPings, () =>
      ctx.providers
        .providersWith(PING_CAPABILITY)
        .map((p) => `${p.id}:${ctx.providers.capability(p.id, PING_CAPABILITY)?.ping()}`),
    )
    ctx.ipc.handle(ProbeIpc.settings, () => ctx.settings.get())
    ctx.ipc.handle(ProbeIpc.resourcePath, ({ rel }) => ctx.paths.resource(PROBE_ID, rel))
    ctx.ipc.handle(ProbeIpc.buildMarker, () => ({
      text: readFileSync(ctx.paths.resource(PROBE_ID, BUILD_MARKER), UTF8),
    }))
    const tick = () => ctx.ipc.publish(ProbeIpc.tick, { count: PROBE_BADGE_COUNT })
    // The renderer asks once it is subscribed; an event published before any window exists has no receiver.
    ctx.ipc.handle(ProbeIpc.requestTick, tick)
    tick()
  },
})
