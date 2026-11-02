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
type Of<K extends ChatEvent['kind']> = Extract<ChatEvent, { kind: K }>
export const task = (patch: Partial<Of<'task'>> = {}): ChatEvent => ({
  kind: 'task',
  taskId: 'task1',
  toolCallId: 'tc-task',
  taskKind: 'subagent',
  name: 'Explore',
  description: 'Find the config loader',
  status: 'running',
  lastTool: 'Grep',
  usage: { tokens: 12_300, costUsd: 0.02 },
  ...patch,
})
export const taskCall = (patch: Partial<Of<'tool-call'>> = {}): ChatEvent =>
  tool('tc-task', {
    name: 'Task',
    toolKind: 'task',
    title: 'Find the config loader',
    input: { subagent_type: 'Explore', prompt: 'Look for the loader' },
    ...patch,
  })
export const childText = (partId: string, t: string, parentId = 'tc-task'): ChatEvent => ({
  ...(text(partId, t) as Of<'text-delta'>),
  parentId,
})
export const question = (patch: Partial<Of<'question'>> = {}): ChatEvent => ({
  kind: 'question',
  eventId: 'q1',
  questions: [
    {
      question: 'Which database?',
      header: 'DB',
      multiSelect: false,
      options: [{ label: 'Postgres', description: 'Relational, scales' }, { label: 'SQLite' }],
    },
  ],
  ...patch,
})
export const plan = (patch: Partial<Of<'plan-proposal'>> = {}): ChatEvent => ({
  kind: 'plan-proposal',
  eventId: 'p1',
  plan: '# Plan\n\n1. Add the loader\n2. Test it',
  ...patch,
})
export const modes = (current = 'plan'): ChatEvent => ({
  kind: 'options',
  options: [
    {
      key: 'permissionMode',
      type: 'enum',
      labelKey: 'chat:option.permissionMode',
      default: 'default',
      current,
      values: [
        { value: 'default', label: 'Ask', tone: 'neutral', description: 'Ask before edits' },
        { value: 'acceptEdits', label: 'Accept edits', tone: 'info' },
        { value: 'plan', label: 'Plan', tone: 'accent' },
        { value: 'bypass', label: 'Bypass', tone: 'err', dangerous: true, requiresConfirm: true, cycle: false },
      ],
    },
  ],
})
export const actions = (...list: NonNullable<Of<'session-info'>['actions']>): ChatEvent => ({
  kind: 'session-info',
  actions: list,
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
