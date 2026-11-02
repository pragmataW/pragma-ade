import {
  getSessionMessages,
  getSubagentMessages,
  listSubagents,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { type ChatEvent, type ChatHistoryContext, MESSAGE_ORIGIN } from '@pragma/module-chat/contract'
import { createSdkMessageMapper, type MapperFrame } from './mapper'

/** The main transcript: the worktree's project dir first, then every project (the CLI's dir naming can differ). */
async function mainMessages(id: string, dir: string): Promise<{ messages: SessionMessage[]; dir?: string }> {
  const messages = await getSessionMessages(id, { dir })
  if (messages.length > 0) return { messages, dir }
  return { messages: await getSessionMessages(id) }
}

/** Every subagent's transcript (its frames carry the spawning tool call id, so they nest under it). */
async function subagentMessages(id: string, dir: string | undefined): Promise<SessionMessage[]> {
  const opts = dir ? { dir } : {}
  const agents = await listSubagents(id, opts).catch((): string[] => [])
  const lists = await Promise.all(agents.map((a) => getSubagentMessages(id, a, opts).catch((): SessionMessage[] => [])))
  return lists.flat()
}

/**
 * The CLI's own JSONL transcript of `externalSessionId` (no copy of ours), subagent conversations included.
 * Limitation: the SDK reads the main-process `CLAUDE_CONFIG_DIR`, not the profile env's.
 */
export async function loadClaudeHistory(ctx: ChatHistoryContext): Promise<ChatEvent[]> {
  const { messages, dir } = await mainMessages(ctx.externalSessionId, ctx.worktreePath)
  const nested = await subagentMessages(ctx.externalSessionId, dir)
  const mapper = createSdkMessageMapper({ origin: MESSAGE_ORIGIN.history })
  return [...[...messages, ...nested].flatMap((m) => mapper.map(m as MapperFrame)), ...mapper.finish()]
}
