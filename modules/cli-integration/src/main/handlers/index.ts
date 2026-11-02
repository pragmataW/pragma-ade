import type { CliMethod } from '../../contract'
import type { CliHandler } from '../lib/define-cli-handler'
import { agentHandlers } from './agent'
import { commentsHandlers } from './comments'
import { taskHandlers } from './task'
import type { CliHandlerDeps } from './types'
import { worktreeHandlers } from './worktree'

export type { CliHandlerDeps } from './types'

/** Handler map for `bridge.registerHandler('cli', …)` (the ping is added by the module's `activate`). */
export function createCliHandlers(deps: CliHandlerDeps): Partial<Record<CliMethod, CliHandler>> {
  return { ...worktreeHandlers(deps), ...agentHandlers(deps), ...commentsHandlers(deps), ...taskHandlers(deps) }
}
