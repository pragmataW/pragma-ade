import { describe, expect, it } from 'vitest'
import { splitFences } from '../../src/renderer/lib/markdown-segments'
import { holdPartialTable } from '../../src/renderer/lib/stream-stable'

describe('holdPartialTable', () => {
  it.each([
    ['no table', 'text\nmore', 'text\nmore'],
    ['row being typed', '| a | b |\n| - | - |\n| 1 | 2 |\n| 3', '| a | b |\n| - | - |\n| 1 | 2 |'],
    ['finished row kept', '| a | b |\n| - | - |\n| 1 | 2 |\n', '| a | b |\n| - | - |\n| 1 | 2 |\n'],
    ['header without delimiter', 'Intro\n| a | b |\n', 'Intro'],
    ['delimiter being typed', 'Intro\n| a | b |\n| -', 'Intro'],
    ['pipe line in prose', '| quoted\nnext', '| quoted\nnext'],
  ])('%s', (_label, md, out) => expect(holdPartialTable(md)).toBe(out))
})

describe('splitFences', () => {
  it.each([
    ['plain', [{ kind: 'prose', text: 'plain' }]],
    [
      'a\n```ts\nx\n```\nb',
      [
        { kind: 'prose', text: 'a' },
        { kind: 'code', code: 'x', lang: 'ts', closed: true },
        { kind: 'prose', text: 'b' },
      ],
    ],
    ['~~~\ny\n~~~', [{ kind: 'code', code: 'y', lang: '', closed: true }]],
    ['```\nopen', [{ kind: 'code', code: 'open', lang: '', closed: false }]],
    ['````md\n```\ninner\n```\n````', [{ kind: 'code', code: '```\ninner\n```', lang: 'md', closed: true }]],
    [' ```ts\nx\n```', [{ kind: 'code', code: 'x', lang: 'ts', closed: true }]],
    [
      '- a\n```ts\nx\n```',
      [
        { kind: 'prose', text: '- a' },
        { kind: 'code', code: 'x', lang: 'ts', closed: true },
      ],
    ],
  ])('%j', (md, segments) => expect(splitFences(md)).toEqual(segments))

  // GPT-style replies (common with OpenCode) put fences inside list items: they stay in the list
  it.each([
    '1. step\n   ```yaml\n   a: 1\n   ```\n   more\n2. next',
    '- item\n\n  ```ts\n  x\n  ```\n- other',
    '* a\n  continued\n  ```\n  plain\n  ```',
  ])('keeps the list-item fence of %j in the prose', (md) =>
    expect(splitFences(md)).toEqual([{ kind: 'prose', text: md }]),
  )
})
