import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import type { ComponentType } from 'react'
import { PROBE_GREETING } from '../constants'

/** The probe consumes two capabilities, so it declares their types (§5.1, §5.3). */
declare module '@pragma/sdk' {
  interface CapabilityMap {
    ping: { ping(): string }
  }
  interface RendererCapabilityMap {
    badge: { Badge: ComponentType }
  }
}

export const ProbeSettingsSchema = z.object({ greeting: z.string().default(PROBE_GREETING) })
export type ProbeSettings = z.infer<typeof ProbeSettingsSchema>

const none = z.void()
const Rect = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })

export const ProbeIpc = {
  ping: defineIpc({
    channel: 'probe.ping',
    input: z.object({ msg: z.string() }),
    output: z.object({ pong: z.string() }),
  }),
  countItems: defineIpc({ channel: 'probe.countItems', input: none, output: z.object({ count: z.number() }) }),
  providerPings: defineIpc({ channel: 'probe.providerPings', input: none, output: z.array(z.string()) }),
  settings: defineIpc({ channel: 'probe.settings', input: none, output: ProbeSettingsSchema }),
  resourcePath: defineIpc({ channel: 'probe.resourcePath', input: z.object({ rel: z.string() }), output: z.string() }),
  buildMarker: defineIpc({ channel: 'probe.buildMarker', input: none, output: z.object({ text: z.string() }) }),
  requestTick: defineIpc({ channel: 'probe.requestTick', input: none, output: none }),
  tick: defineIpcEvent({ channel: 'probe.tick', payload: z.object({ count: z.number() }) }),
  testHookActive: defineIpc({ channel: 'probe.testHookActive', input: none, output: z.boolean() }),
  openNativeView: defineIpc({ channel: 'probe.openNativeView', input: none, output: none }),
  nativeViewState: defineIpc({
    channel: 'probe.nativeViewState',
    input: none,
    output: z.object({ bounds: Rect, visible: z.boolean() }),
  }),
  capabilityDisposed: defineIpc({ channel: 'probe.capabilityDisposed', input: none, output: z.boolean() }),
} as const

export { PROBE_BADGE_COUNT, PROBE_COMMANDS, PROBE_ID, PROBE_INSET_TOP_PX, PROBE_VIEW_ID } from '../constants'
export { PROBE_TEST_IDS } from './testids'
