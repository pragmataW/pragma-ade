import { expect, test } from 'vitest'
import { groupThreads, pageLabel } from '../../src/renderer/lib/group-threads'
import { aThread } from '../../src/testing'

const element = (url: string) => ({
  url,
  selector: 'button',
  outerHtml: '<button></button>',
  boundingBox: { x: 0, y: 0, width: 1, height: 1 },
})

test('groups by file (diff and editor together) and by page, in order of each group’s first thread', () => {
  const a1 = aThread({ id: 'a1', filePath: 'src/a.ts' })
  const b1 = aThread({ id: 'b1', source: 'editor', filePath: 'b.md' })
  const p1 = aThread({ id: 'p1', source: 'browser', filePath: undefined, element: element('http://x.dev/a?q=1') })
  const a2 = aThread({ id: 'a2', source: 'editor', filePath: 'src/a.ts' })
  const p2 = aThread({ id: 'p2', source: 'browser', filePath: undefined, element: element('http://x.dev/a?q=1') })
  const groups = groupThreads([a1, b1, p1, a2, p2])
  expect(groups.map((g) => [g.kind, g.key, g.threads.map((t) => t.id)])).toEqual([
    ['file', 'src/a.ts', ['a1', 'a2']],
    ['file', 'b.md', ['b1']],
    ['page', 'http://x.dev/a?q=1', ['p1', 'p2']],
  ])
})

test('a page label is host and path', () => {
  expect(pageLabel('http://localhost:5173/settings?tab=1#x')).toBe('localhost:5173/settings')
  expect(pageLabel('not a url')).toBe('not a url')
})
