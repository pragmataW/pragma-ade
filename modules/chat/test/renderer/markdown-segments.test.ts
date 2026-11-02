import { describe, expect, it } from 'vitest'
import { splitFences } from '../../src/renderer/lib/markdown-segments'

describe('splitFences', () => {
  it.each([
    ['plain', [{ kind: 'prose', text: 'plain' }]],
    [
      'a\n```ts\nx\n```\nb',
      [
        { kind: 'prose', text: 'a' },
        { kind: 'code', code: 'x', lang: 'ts' },
        { kind: 'prose', text: 'b' },
      ],
    ],
    ['~~~\ny\n~~~', [{ kind: 'code', code: 'y', lang: '' }]],
    ['```\nopen', [{ kind: 'code', code: 'open', lang: '' }]],
    ['````md\n```\ninner\n```\n````', [{ kind: 'code', code: '```\ninner\n```', lang: 'md' }]],
  ])('%j', (md, segments) => expect(splitFences(md)).toEqual(segments))
})
