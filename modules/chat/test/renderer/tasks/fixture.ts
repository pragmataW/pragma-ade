import type { ChatEvent } from '../../../src/contract'
import { childText, result, task, taskCall, user } from '../parts/samples'

/**
 * A session with a running workflow (two subagents, one of them with a nested helper that nests through its parent's
 * tool call id, as OpenCode does), a paused root subagent and a failed background job.
 */
export const TASKS_SCENARIO: ChatEvent[] = [
  user('u1', 'ship it'),
  task({ taskId: 'wf', toolCallId: undefined, taskKind: 'workflow', name: 'release', description: 'Ship 1.2' }),
  taskCall({ toolCallId: 'tc1', input: { subagent_type: 'Explore', prompt: 'Find the loader' } }),
  task({ taskId: 't1', toolCallId: 'tc1', parentId: 'wf', status: 'completed', summary: 'Loader is in config.ts' }),
  childText('c1', 'looking in src/', 'tc1'),
  result('tc1', 'final report: config.ts'),
  taskCall({ toolCallId: 'tc2', input: { subagent_type: 'Plan', prompt: 'Plan the change' } }),
  task({
    taskId: 't2',
    toolCallId: 'tc2',
    parentId: 'wf',
    name: 'Plan',
    description: 'Plan the change',
    usage: { tokens: 18_400, toolUses: 7, costUsd: 0.05 },
  }),
  task({ taskId: 't3', toolCallId: 'tc3', parentId: 'tc2', name: 'grep-helper', description: 'Search usages' }),
  task({ taskId: 't4', toolCallId: 'tc4', name: 'Review', description: 'Review the diff', status: 'paused' }),
  task({ taskId: 't5', toolCallId: 'tc5', taskKind: 'background', name: 'lint', status: 'failed' }),
]

export const IDS_IN_ORDER = ['wf', 't1', 't2', 't3', 't4', 't5'] as const
