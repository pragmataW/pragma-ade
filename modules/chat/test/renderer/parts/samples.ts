import type { ChatEvent } from '../../../src/contract'

export const tool = (id: string, extra: Partial<Extract<ChatEvent, { kind: 'tool-call' }>> = {}): ChatEvent => ({
  kind: 'tool-call',
  toolCallId: id,
  name: 'Bash',
  toolKind: 'shell',
  title: `ls ${id}`,
  input: { command: `ls ${id}` },
  status: 'running',
  ...extra,
})
export const result = (id: string, output: string, status: 'completed' | 'error' = 'completed'): ChatEvent => ({
  kind: 'tool-result',
  toolCallId: id,
  status,
  output,
})
export const edit = (id: string, before = 'a\n', after = 'b\n'): ChatEvent => ({
  kind: 'file-edit',
  toolCallId: id,
  path: 'src/app.ts',
  change: 'edit',
  hunks: [{ before, after }],
})
export const text = (partId: string, t: string): ChatEvent => ({
  kind: 'text-delta',
  messageId: 'm',
  partId,
  text: t,
  mode: 'snapshot',
})
export const user = (id: string, t = 'hi'): ChatEvent => ({
  kind: 'message',
  messageId: id,
  role: 'user',
  text: t,
  attachments: [],
  origin: 'live',
})
export const permission = (options: ('allow_once' | 'allow_always' | 'deny')[]): ChatEvent => ({
  kind: 'permission-request',
  requestId: 'r1',
  toolName: 'Edit',
  toolKind: 'edit',
  title: 'README.md',
  input: { file_path: 'README.md', old_string: 'old line', new_string: 'new line' },
  options,
})
