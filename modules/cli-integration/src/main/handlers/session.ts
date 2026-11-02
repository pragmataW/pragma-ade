import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { locateSession } from '../session-transcripts'
import type { CliHandlerDeps } from './types'

export function sessionHandlers({
  agents,
  projects,
  transcripts,
}: CliHandlerDeps): Record<'sessionLocate', CliHandler> {
  return {
    sessionLocate: defineCliHandler(CLI_METHOD.sessionLocate, (req) =>
      locateSession({ agents, projects, locator: transcripts }, req.sessionId, req.context),
    ),
  }
}
