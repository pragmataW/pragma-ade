import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import type { CliHandlerDeps } from './types'

export function askHandlers(deps: CliHandlerDeps): Record<'ask' | 'askWait', CliHandler> {
  return {
    ask: defineCliHandler(CLI_METHOD.ask, (req) => deps.asks.start(req)),
    askWait: defineCliHandler(CLI_METHOD.askWait, (req) => deps.asks.wait(req.askId)),
  }
}
