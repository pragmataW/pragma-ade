import type { ChatEvent } from '@pragma/module-chat/contract'
import { makeTranscript } from '@pragma/module-chat/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { parseV2Event } from '../src/main/chat/schemas'
import { SubagentTracker, subagentSummary } from '../src/main/chat/subagents'
import type { HubEvent } from '../src/main/chat/wire/event-hub'
import {
  chatSetup,
  cleanupAll,
  FAKE_SID,
  ofKind,
  requestsOf,
  scenarioEvents,
  waitForEvent,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const hubEvents = (turn: number): HubEvent[] =>
  scenarioEvents('subagent', turn).flatMap((r) => {
    const e = parseV2Event(r)
    return e && e.type !== 'other' ? [e] : []
  })

/** Feeds a scenario turn through a tracker the way the hub routes it (child events to child subscribers). */
function track(turn: number) {
  const out: ChatEvent[] = []
  const subs = new Map<string, (e: HubEvent) => void>()
  let clock = 1000
  const tracker = new SubagentTracker({
    rootSessionId: FAKE_SID,
    subscribe: (id, cb) => {
      subs.set(id, cb)
      return () => subs.delete(id)
    },
    emit: (e) => void out.push(e),
    contextWindow: () => undefined,
    now: () => {
      clock += 100
      return clock
    },
  })
  for (const e of hubEvents(turn)) {
    const sid = (e.data as { sessionID?: string; parentID?: string }).sessionID
    const child = sid ? subs.get(sid) : undefined
    if (e.type === 'session.created' || !child) tracker.observe(FAKE_SID, e)
    else child(e)
  }
  return { out, tracker, subs }
}

describe('SubagentTracker', () => {
  it('a subagent tool call becomes a live task; its output nests under the tool call', () => {
    const { out } = track(0)
    const tasks = ofKind(out, 'task')
    expect(tasks[0]).toMatchObject({
      taskId: 'ses_child1',
      toolCallId: 'call_sub',
      taskKind: 'subagent',
      name: 'explore',
      description: 'Find config files',
      status: 'running',
      depth: 0,
    })
    expect(tasks.at(-1)).toMatchObject({ status: 'completed', summary: 'Found a.json' })
    expect(tasks.at(-1)?.usage).toMatchObject({ tokens: 1000, costUsd: 0.002, toolUses: 1 })
    expect(tasks.some((t) => t.lastTool === 'config')).toBe(true)
    const nested = out.filter((e) => e.kind !== 'task' && e.kind !== 'tool-result')
    expect(nested.every((e) => 'parentId' in e && e.parentId === 'call_sub')).toBe(true)
    expect(ofKind(out, 'turn-end')).toEqual([])
    expect(ofKind(out, 'usage')).toEqual([])
  })

  it('the kit transcript renders the child output inside the task (by tool call id)', () => {
    const t = makeTranscript(track(0).out)
    expect(t.children.call_sub?.length).toBeGreaterThan(0)
    expect(t.items.filter((i) => i.kind === 'task')).toHaveLength(1)
  })

  it('a stopped subagent ends killed; a failed tool result ends it failed with the error', () => {
    const tasks = ofKind(track(1).out, 'task')
    expect(tasks.map((t) => t.status)).toEqual(['running', 'killed', 'failed'])
    expect(tasks.at(-1)?.summary).toBe('The subagent was stopped')
  })

  it('endAll ends live subagents with the parent turn; dispose unsubscribes', () => {
    const { tracker, out, subs } = track(1)
    expect(tracker.live).toEqual([])
    tracker.dispose()
    expect(subs.size).toBe(0)
    expect(out.length).toBeGreaterThan(0)
  })

  it.each([
    ['<subagent sessionID="x" state="completed">\nanswer\n</subagent>', 'answer'],
    ['plain', 'plain'],
    ['', undefined],
  ])('subagentSummary(%j)', (text, expected) => {
    expect(subagentSummary(text ? [{ type: 'text', text }] : [])).toBe(expected)
  })
})

describe('opencode chat session subagents', () => {
  it('streams child session events as a task with nested output; parent turn completes', async () => {
    const s = chatSetup({ scenario: 'subagent' })
    const h = await s.start()
    await h.send({ text: 'find configs', images: [] })
    await waitForEvent(s.events, 'turn-end')
    const tasks = ofKind(s.events, 'task')
    expect(tasks.at(-1)).toMatchObject({ taskId: 'ses_child1', status: 'completed', summary: 'Found a.json' })
    const nestedText = ofKind(s.events, 'text-delta').filter((e) => e.parentId === 'call_sub')
    expect(nestedText.map((e) => e.text).join('')).toContain('Found a.json')
    expect(ofKind(s.events, 'turn-end').map((e) => e.reason)).toEqual(['completed'])
  })

  it('stopTask interrupts the child session', async () => {
    const s = chatSetup({ scenario: 'subagent' })
    const h = await s.start()
    await h.send({ text: 'one', images: [] })
    await waitForEvent(s.events, 'turn-end')
    await h.send({ text: 'two', images: [] })
    await waitForEvent(s.events, 'task', (t) => t.taskId === 'ses_child2')
    await h.stopTask?.('ses_child2')
    await h.stopTask?.('unknown')
    expect(requestsOf(s.h.log, /\/interrupt$/).map((r) => r.path)).toEqual(['/api/session/ses_child2/interrupt'])
  })
})
