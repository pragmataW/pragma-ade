import type { LaunchContext, LaunchSpec } from '@pragma/module-agents/contract'
import type { AgentStatusEvent } from './status'

/** 03's `LaunchContext` (incl. `tempDir`/`writeTempFile`) plus the bridge connection. */
export type StatusLaunchContext = LaunchContext & { bridgeUrl: string; bridgeToken: string }

/** Provider capability `status` (§5.2): inject hooks into a launch, translate hook payloads. */
export interface StatusCapability {
  decorateLaunch(spec: LaunchSpec, ctx: StatusLaunchContext): Promise<LaunchSpec>
  /** null = not a status-relevant event. */
  parseEvent(raw: unknown): AgentStatusEvent | null
  dispose?(): void
}

declare module '@pragma/sdk' {
  interface CapabilityMap {
    status: StatusCapability
  }
}
