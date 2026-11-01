import { expect, test } from 'vitest'
import { getHighlighter, highlight, highlightToHtml } from '../src/lib/highlight'

test('getHighlighter is created once', async () => {
  expect(await getHighlighter()).toBe(await getHighlighter())
})
test('highlight tokenizes ts keywords with the keyword var', async () => {
  const { lines } = await highlight('const x = 1', 'ts')
  expect(lines[0]?.find((t) => t.content.includes('const'))?.color).toContain('--shiki-token-keyword')
})
test('unknown lang falls back to text', async () => {
  const { lines } = await highlight('just words', 'klingon')
  expect(lines[0]?.map((t) => t.content).join('')).toBe('just words')
})
test('highlightToHtml escapes <script>', async () => {
  const html = await highlightToHtml('<script>alert(1)</script>', 'html')
  expect(html).toContain('class="shiki')
  expect(html).not.toContain('<script>')
})
