import {
  getSessionMessages,
  getSubagentMessages,
  listSubagents,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { type ChatEvent, type ChatHistoryContext, MESSAGE_ORIGIN } from '@pragma/module-chat/contract'
import { BLOCK, CLAUDE_TOOLS } from './constants'
import { list, obj, str } from './frame-fields'
import { createSdkMessageMapper, type MapperFrame } from './mapper'

/** The main transcript: the worktree's project dir first, then every project (the CLI's dir naming can differ). */
async function mainMessages(id: string, dir: string): Promise<{ messages: SessionMessage[]; dir?: string }> {
  const messages = await getSessionMessages(id, { dir })
  if (messages.length > 0) return { messages, dir }
  return { messages: await getSessionMessages(id) }
}

/** The transcript file's ISO timestamp (on every record, not in the SDK's type). */
const timeOf = (m: SessionMessage | undefined): string => str(obj(m).timestamp) ?? ''

/** The Workflow tool calls of the main transcript, in order, with the time they were made. */
function workflowCalls(messages: SessionMessage[]): { id: string; at: string }[] {
  return messages.flatMap((m) =>
    m.type === 'assistant'
      ? list(obj(m.message).content)
          .filter((b) => b.type === BLOCK.toolUse && b.name === CLAUDE_TOOLS.workflow)
          .map((b) => ({ id: str(b.id) ?? '', at: timeOf(m) }))
      : [],
  )
}

/**
 * A subagent transcript without a spawning tool call (an agent a workflow script ran: its sidecar names no tool
 * call) belongs to the latest Workflow call made before it started; with none it is left out, so its prompt and
 * replies never read as the main conversation.
 */
function adopt(agent: SessionMessage[], calls: { id: string; at: string }[]): SessionMessage[] {
  if (agent.length === 0 || agent.some((m) => m.parent_tool_use_id)) return agent
  const start = timeOf(agent[0])
  const owner = calls.filter((c) => c.at <= start).at(-1)
  return owner ? agent.map((m) => ({ ...m, parent_tool_use_id: owner.id })) : []
}

/** Every subagent's transcript (its frames carry the spawning tool call id, so they nest under it). */
async function subagentMessages(
  id: string,
  dir: string | undefined,
  main: SessionMessage[],
): Promise<SessionMessage[]> {
  const opts = dir ? { dir } : {}
  const agents = await listSubagents(id, opts).catch((): string[] => [])
  const lists = await Promise.all(agents.map((a) => getSubagentMessages(id, a, opts).catch((): SessionMessage[] => [])))
  const calls = workflowCalls(main)
  return lists.flatMap((l) => adopt(l, calls))
}

/**
 * The CLI's own JSONL transcript of `externalSessionId` (no copy of ours), subagent conversations included.
 * Limitation: the SDK reads the main-process `CLAUDE_CONFIG_DIR`, not the profile env's.
 */
export async function loadClaudeHistory(ctx: ChatHistoryContext): Promise<ChatEvent[]> {
  const { messages, dir } = await mainMessages(ctx.externalSessionId, ctx.worktreePath)
  const nested = await subagentMessages(ctx.externalSessionId, dir, messages)
  const mapper = createSdkMessageMapper({ origin: MESSAGE_ORIGIN.history })
  return [...[...messages, ...nested].flatMap((m) => mapper.map(m as MapperFrame)), ...mapper.finish()]
}
