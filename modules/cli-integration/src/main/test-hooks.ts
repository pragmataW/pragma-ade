import { defineTestHooks } from '@pragma/sdk/main'
import type { NotificationRequest } from './notifier'
import type { CliPaths } from './paths'
import { runtimeState } from './state'

/** `globalThis.__pragmaCliIntegrationTest` (only with `PRAGMA_TEST=1`). */
export interface CliIntegrationTestHooks {
  /** Every notification the module requested (handoff, skills outdated). */
  notifications(): NotificationRequest[]
  /** The resolved bundle/skills/bin/bridge paths. */
  paths(): CliPaths | null
}
export type CliIntegrationTestGlobal = { __pragmaCliIntegrationTest: CliIntegrationTestHooks }

export default defineTestHooks(() => {
  ;(globalThis as unknown as CliIntegrationTestGlobal).__pragmaCliIntegrationTest = {
    notifications: () => [...runtimeState.notifications],
    paths: () => runtimeState.paths,
  }
})
