import { describe, expect, it } from 'vitest'
import {
  FAKE_AGENT_TOOL_ID,
  FAKE_SUBAGENT_TEXT,
  FAKE_TASK_ID,
  FAKE_WORKFLOW_TASK_ID,
} from '../../testing/fake-claude-stream/scenario'
import { isKind, ofKind, startSession } from './support'

/** A started session after one completed turn of `scenario`. */
async function turnOf(scenario: Parameters<typeof startSession>[0]) {
  const s = await startSession(scenario)
  await s.send('go')
  await s.waitForEvent(isKind('turn-end'))
  return s
}

describe('ClaudeChatSession tasks (fake CLI through the real SDK)', () => {
  it('subagent: task card lifecycle and its output nested under the Agent tool call', async () => {
    const s = await turnOf('subagent')
    const tasks = ofKind(s.events, 'task')
    expect(tasks.map((t) => t.status)).toEqual(['running', 'running', 'completed'])
    expect(tasks[0]).toMatchObject({ taskId: FAKE_TASK_ID, taskKind: 'subagent', name: 'Explore' })
    expect(tasks[1]).toMatchObject({ summary: 'Reading the repository root', lastTool: 'Bash' })
    const nested = s.events.filter((e) => 'parentId' in e && e.parentId === FAKE_AGENT_TOOL_ID)
    expect(nested.map((e) => e.kind)).toEqual(expect.arrayContaining(['text-delta', 'tool-call']))
    expect(nested.find(isKind('text-delta', (e) => e.text === FAKE_SUBAGENT_TEXT))).toBeDefined()
  })

  it('workflow: a workflow task with a nested subagent task', async () => {
    const s = await turnOf('workflow')
    const tasks = ofKind(s.events, 'task')
    expect(tasks[0]).toMatchObject({ taskId: FAKE_WORKFLOW_TASK_ID, taskKind: 'workflow', name: 'spec' })
    expect(tasks.find((t) => t.taskId === 'wf_child_1')).toMatchObject({ parentId: FAKE_WORKFLOW_TASK_ID, depth: 2 })
  })

  it('background-task: a running background job; stopTask sends stop_task', async () => {
    const s = await turnOf('background-task')
    expect(s.events.find(isKind('task'))).toMatchObject({ taskKind: 'background', name: 'Bash', status: 'running' })
    await s.session.stopTask('bash_bg_1')
    expect(s.report()?.controlRequests.map((f) => f.request)).toContainEqual(
      expect.objectContaining({ subtype: 'stop_task', task_id: 'bash_bg_1' }),
    )
  })

  it('rate-limit: a warning banner and a retry notice before the answer', async () => {
    const s = await turnOf('rate-limit')
    expect(s.events.find(isKind('rate-limit'))).toMatchObject({ status: 'warning', window: 'five_hour' })
    expect(s.events.find(isKind('retry'))).toMatchObject({ attempt: 1, maxAttempts: 10, reason: 'overloaded' })
  })
})
