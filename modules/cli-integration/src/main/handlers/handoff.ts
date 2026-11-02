import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import type { CliHandlerDeps } from './types'

export function handoffHandlers(deps: CliHandlerDeps): Record<'handoff', CliHandler> {
  return { handoff: defineCliHandler(CLI_METHOD.handoff, (req) => deps.handoff(req)) }
}
