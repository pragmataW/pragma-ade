import {
  INVALID_EXTERNAL_ID_MESSAGE,
  isSafeExternalSessionId,
  type ResumeCapability,
  type ResumeSpec,
} from '@pragma/module-chat-switch/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { passwordForServerUrl } from './chat/server/passwords'

/** OpenCode session ids (`packages/schema/src/session-id.ts`). */
export const OPENCODE_SESSION_PREFIX = 'ses'
const SESSION_FLAG = '--session'
const SERVER_FLAG = '--server'
/** Basic auth for `--server` comes only from this env (username `opencode`). */
const PASSWORD_ENV = 'OPENCODE_PASSWORD'
export const UNKNOWN_SERVER_MESSAGE = 'unknown opencode server'

/**
 * 11c, OpenCode 2.x only (verified: opencode v2.2.5 `packages/cli/src/commands/commands.ts`: `-s, --session` continues
 * a session or creates one for an unknown id, so only reported ids are passed; `--server <url>` joins a server).
 * Without `serverUrl` 03 adds `--standalone`; with it the TUI joins the worktree's chat `serve`.
 */
export function createOpencodeResumeCapability(deps: {
  passwordFor(url: string): string | undefined
}): ResumeCapability {
  return {
    canResumeInChat: true,
    terminalResumeArgs({ externalSessionId, serverUrl }): ResumeSpec {
      if (!isSafeExternalSessionId(externalSessionId) || !externalSessionId.startsWith(OPENCODE_SESSION_PREFIX))
        throw new Error(INVALID_EXTERNAL_ID_MESSAGE)
      const session = [SESSION_FLAG, externalSessionId]
      if (serverUrl === undefined) return { args: session, env: {} }
      const password = deps.passwordFor(serverUrl)
      if (password === undefined) throw new Error(UNKNOWN_SERVER_MESSAGE)
      return { args: [SERVER_FLAG, serverUrl, ...session], env: { [PASSWORD_ENV]: password } }
    },
  }
}

export default defineCapability(
  PROVIDER_ID,
  'resume',
  createOpencodeResumeCapability({ passwordFor: passwordForServerUrl }),
)
