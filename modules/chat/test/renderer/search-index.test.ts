import { describe, expect, it } from 'vitest'
import type { ChatEvent, ChatPartComponent, ChatPartKey } from '../../src/contract'
import { buildRows } from '../../src/renderer/kit/parts/rows'
import { buildSearchIndex, findMatches } from '../../src/renderer/lib/search-index'
import { makeTranscript } from '../../testing'
import { text, tool, user } from './parts/samples'

const Part: ChatPartComponent = () => null
const PARTS: Partial<Record<ChatPartKey, ChatPartComponent>> = {
  message: Part,
  'text-delta': Part,
  'tool-call': Part,
  thinking: Part,
  'custom:test.x': Part,
}
const indexOf = (events: ChatEvent[], parts = PARTS) =>
  buildSearchIndex(buildRows(makeTranscript(events).items, parts, { groupToolCalls: true, turnHeader: false }), parts)

describe('in-chat search index', () => {
  it.each([
    [
      ['Hello world', 'say hello', 'x'],
      'HELLO',
      [
        { rowIndex: 0, occurrence: 0 },
        { rowIndex: 1, occurrence: 0 },
      ],
    ],
    [['a.b', 'axb'], 'a.b', [{ rowIndex: 0, occurrence: 0 }]],
    [['anything'], '', []],
    [
      ['hello hello'],
      'hello',
      [
        { rowIndex: 0, occurrence: 0 },
        { rowIndex: 0, occurrence: 1 },
      ],
    ],
  ])('findMatches(%j, %j)', (index, query, matches) => expect(findMatches(index, query)).toEqual(matches))

  it('index skips thinking, tool output, custom, and kinds missing from parts', () => {
    const events: ChatEvent[] = [
      user('u1', 'find me'),
      { kind: 'thinking', messageId: 'm', partId: 'th', text: 'secret thought', mode: 'snapshot' },
      tool('t1', { title: 'ls src' }),
      { kind: 'tool-result', toolCallId: 't1', status: 'completed', output: 'hidden output' },
      { kind: 'custom', type: 'test.x', data: { text: 'custom text' } },
      text('p1', '**bold** [link](https://x.dev) `code`'),
    ]
    const index = indexOf(events)
    expect(index.join('|')).toContain('find me')
    expect(index.join('|')).toContain('ls src')
    expect(index.join('|')).toContain('bold link code')
    for (const hidden of ['secret thought', 'hidden output', 'custom text', 'https://x.dev'])
      expect(index.join('|')).not.toContain(hidden)
    const { message: _m, ...withoutMessages } = PARTS
    expect(indexOf(events, withoutMessages).join('|')).not.toContain('find me')
  })
})
