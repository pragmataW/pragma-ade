/** SDK frames shaped exactly like `fake-claude`'s output (stream events, one block per assistant frame). */
import { createSdkMessageMapper, type MapperFrame } from '../../src/main/chat/mapper'
import { FAKE_EDIT_INPUT, FAKE_EDIT_TOOL_ID } from '../../testing/fake-claude-stream/scenario'

/** Every event one fresh mapper yields for `frames`. */
export const mapAll = (frames: unknown[], opts?: Parameters<typeof createSdkMessageMapper>[0]) => {
  const m = createSdkMessageMapper(opts)
  return frames.flatMap((f) => m.map(f as MapperFrame))
}

const SESSION = 'sess-1'
const meta = (uuid: string) => ({ parent_tool_use_id: null, uuid, session_id: SESSION })
export const usage = {
  input_tokens: 120,
  output_tokens: 40,
  cache_read_input_tokens: 30,
  cache_creation_input_tokens: 10,
}

export const stream = (event: Record<string, unknown>) => ({ type: 'stream_event', event, ...meta('se') })
export const messageStart = (id: string) => stream({ type: 'message_start', message: { id, role: 'assistant' } })
export const blockStart = (index: number, block: Record<string, unknown>) =>
  stream({ type: 'content_block_start', index, content_block: block })
export const textDelta = (index: number, text: string) =>
  stream({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } })
export const thinkingDelta = (index: number, thinking: string) =>
  stream({ type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking } })

export const assistant = (id: string, block: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: 'assistant',
  message: { id, type: 'message', role: 'assistant', model: 'claude-fake-1', content: [block], usage },
  ...meta(`a-${id}`),
  ...extra,
})
export const text = (t: string) => ({ type: 'text', text: t })
export const thinking = (t: string) => ({ type: 'thinking', thinking: t, signature: 'sig' })
export const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({
  type: 'tool_use',
  id,
  name,
  input,
})
export const editUse = () => toolUse(FAKE_EDIT_TOOL_ID, 'Edit', FAKE_EDIT_INPUT)

export const toolResult = (
  toolUseId: string,
  content: unknown,
  extra: Record<string, unknown> = {},
  isError = false,
) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }] },
  ...meta(`u-${toolUseId}`),
  ...extra,
})
export const userText = (uuid: string, content: unknown) => ({
  type: 'user',
  message: { role: 'user', content },
  ...meta(uuid),
})

export const result = (subtype = 'success', extra: Record<string, unknown> = {}) => ({
  type: 'result',
  subtype,
  is_error: subtype !== 'success',
  total_cost_usd: 0.0123,
  usage,
  modelUsage: { a: { contextWindow: 100_000 }, b: { contextWindow: 200_000 } },
  ...(subtype === 'success' ? { result: '' } : { errors: [] }),
  ...meta('r'),
  ...extra,
})
export const init = () => ({ type: 'system', subtype: 'init', ...meta('i') })
export const compactBoundary = () => ({
  type: 'system',
  subtype: 'compact_boundary',
  compact_metadata: { trigger: 'auto', pre_tokens: 48_000 },
  ...meta('c'),
})

/** A subagent's frames carry the spawning tool call id. */
export const inSubagent = <T extends Record<string, unknown>>(frame: T, parent = 'toolu_agent_1') => ({
  ...frame,
  parent_tool_use_id: parent,
})
export const system = (subtype: string, fields: Record<string, unknown> = {}) => ({
  type: 'system',
  subtype,
  ...meta(`sys-${subtype}`),
  ...fields,
})
export const taskStarted = (fields: Record<string, unknown> = {}) =>
  system('task_started', {
    task_id: 'task-1',
    tool_use_id: 'toolu_agent_1',
    description: 'List files',
    subagent_type: 'general-purpose',
    task_type: 'local_agent',
    is_backgrounded: false,
    spawn_depth: 1,
    ...fields,
  })
export const taskProgress = (fields: Record<string, unknown> = {}) =>
  system('task_progress', {
    task_id: 'task-1',
    description: 'Running ls',
    usage: { total_tokens: 1200, tool_uses: 2, duration_ms: 900 },
    last_tool_name: 'Bash',
    ...fields,
  })
export const taskUpdated = (patch: Record<string, unknown>, taskId = 'task-1') =>
  system('task_updated', { task_id: taskId, patch })
export const taskNotification = (fields: Record<string, unknown> = {}) =>
  system('task_notification', {
    task_id: 'task-1',
    status: 'completed',
    output_file: '/tmp/o',
    summary: 'Two',
    ...fields,
  })
export const rateLimit = (info: Record<string, unknown>) => ({
  type: 'rate_limit_event',
  rate_limit_info: info,
  ...meta('rl'),
})
