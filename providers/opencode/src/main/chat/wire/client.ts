import { OpenCode } from '@opencode/client'
import { AUTHORIZATION_HEADER, DIRECTORY_HEADER } from '../constants'

type FullClient = ReturnType<typeof OpenCode.make>
/** The only namespaces the adapter may use (stable 2.x API; `experimental.*` is never touched). */
export type WireClient = Pick<
  FullClient,
  | 'server'
  | 'session'
  | 'message'
  | 'model'
  | 'agent'
  | 'command'
  | 'permission'
  | 'event'
  | 'provider'
  | 'integration'
  | 'credential'
  | 'mcp'
>

/** A 2.x client bound to one server and one location (the worktree, sent as `x-opencode-directory`). */
export function createWireClient(server: { url: string; authHeader: string }, directory: string): WireClient {
  const c = OpenCode.make({
    baseUrl: server.url,
    headers: { [AUTHORIZATION_HEADER]: server.authHeader, [DIRECTORY_HEADER]: encodeURIComponent(directory) },
  })
  return {
    server: c.server,
    session: c.session,
    message: c.message,
    model: c.model,
    agent: c.agent,
    command: c.command,
    permission: c.permission,
    event: c.event,
    provider: c.provider,
    integration: c.integration,
    credential: c.credential,
    mcp: c.mcp,
  }
}
