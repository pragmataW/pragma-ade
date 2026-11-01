import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { type ChatEvent, type ChatHistoryContext, MESSAGE_ORIGIN } from '@pragma/module-chat/contract'
import { createSdkMessageMapper, type MapperFrame } from './mapper'

/**
 * The CLI's own JSONL transcript of `externalSessionId` (no copy of ours). Looks in the worktree's project dir first,
 * then in every project (the CLI's dir naming can differ for unusual paths). Limitation: the SDK reads the
 * main-process `CLAUDE_CONFIG_DIR`, not the profile env's.
 */
export async function loadClaudeHistory(ctx: ChatHistoryContext): Promise<ChatEvent[]> {
  let messages = await getSessionMessages(ctx.externalSessionId, { dir: ctx.worktreePath })
  if (messages.length === 0) messages = await getSessionMessages(ctx.externalSessionId)
  const mapper = createSdkMessageMapper({ origin: MESSAGE_ORIGIN.history })
  return [...messages.flatMap((m) => mapper.map(m as MapperFrame)), ...mapper.finish()]
}
