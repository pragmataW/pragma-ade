import type { NotificationRequest } from './notifier'
import type { CliPaths } from './paths'

/** Runtime state shared with `test-hooks.ts` (PRAGMA_TEST only reads it). */
export const runtimeState: { paths: CliPaths | null; notifications: NotificationRequest[] } = {
  paths: null,
  notifications: [],
}
