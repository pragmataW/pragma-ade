import type { AgentProfile } from '@pragma/module-agents/contract'
import { type ChatSupport, UNSUPPORTED_REASON } from '@pragma/module-chat/contract'

/** Chat needs a resolvable, executable command (SDK `resolveCommand`, §10.2); the protocol is checked at start. */
export async function checkClaudeSupport(
  profile: AgentProfile,
  resolveCommand: (cmd: string) => Promise<string | null>,
): Promise<ChatSupport> {
  const found = await resolveCommand(profile.command)
  return found ? { ok: true } : { ok: false, reasonKey: UNSUPPORTED_REASON.commandNotFound, detail: profile.command }
}
