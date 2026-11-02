import type { LaunchContext, LaunchSpec } from '@pragma/module-agents/contract'
import type { AgentStatusEvent } from './status'

/** 03's `LaunchContext` (incl. `tempDir`/`writeTempFile`) plus the bridge connection. */
export type StatusLaunchContext = LaunchContext & { bridgeUrl: string; bridgeToken: string }

/** What a session monitor may do. */
export interface StatusMonitorContext {
  /** Applies an event to the session like a hook event (validated first; ignored once the session exited). */
  report(event: AgentStatusEvent): void
}

/**
 * Per-session observer for turn ends the agent's hooks do not report (e.g. Claude fires no hook when the user
 * interrupts a turn). Created on the session's first hook event, disposed when the session exits or closes.
 */
export interface StatusSessionMonitor {
  /** Every hook payload of the session, with its parsed event (null = not status-relevant). */
  onHookEvent(raw: unknown, parsed: AgentStatusEvent | null): void
  /** The session's terminal printed something (no content is passed). */
  onOutput?(): void
  /** The user pressed an interrupt key (Esc or Ctrl-C) in the session's terminal. */
  onInterruptKey?(): void
  dispose(): void
}

/** Provider capability `status` (§5.2): inject hooks into a launch, translate hook payloads. */
export interface StatusCapability {
  decorateLaunch(spec: LaunchSpec, ctx: StatusLaunchContext): Promise<LaunchSpec>
  /** null = not a status-relevant event. */
  parseEvent(raw: unknown): AgentStatusEvent | null
  /** Optional: a monitor for one terminal session (see `StatusSessionMonitor`). */
  monitorSession?(ctx: StatusMonitorContext): StatusSessionMonitor
  dispose?(): void
}

declare module '@pragma/sdk' {
  interface CapabilityMap {
    status: StatusCapability
  }
}
