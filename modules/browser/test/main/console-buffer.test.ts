import { expect, it } from 'vitest'
import {
  type ConsoleEntry,
  createConsoleBuffer,
  formatConsoleEntry,
  normalizeConsoleEvent,
  resizeConsoleBuffer,
} from '../../src/main/console-buffer'

const entry = (line: number): ConsoleEntry => ({ level: 'error', message: 'm', source: 's', line, timestamp: 0 })

it('resize keeps the newest entries', () => {
  const b = createConsoleBuffer(5)
  for (const e of [1, 2, 3, 4, 5].map(entry)) b.push(e)
  expect(
    resizeConsoleBuffer(b, 2)
      .toArray()
      .map((e) => e.line),
  ).toEqual([4, 5])
})

it.each([
  [[{ level: 'error', message: 'boom', lineNumber: 3, sourceId: 'http://x/a.js' }]],
  [[{}, 3, 'boom', 3, 'http://x/a.js']],
])('normalizes console signature %#', (args) =>
  expect(normalizeConsoleEvent(args, 0)).toMatchObject({ level: 'error', message: 'boom', line: 3 }),
)

it.each([[[]], [[{ level: 'nope' }]], [[{}, 9, 'm', 1, 's']]])('rejects malformed console args %#', (args) =>
  expect(normalizeConsoleEvent(args, 0)).toBeNull(),
)

it('formats and clips', () => {
  expect(formatConsoleEntry({ ...entry(7), message: 'x'.repeat(600) })).toBe(`[error] ${'x'.repeat(500)} (s:7)`)
})
