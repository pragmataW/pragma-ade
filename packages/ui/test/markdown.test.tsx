import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Markdown } from '../src/components/markdown'

test('renders GFM table and task list', () => {
  const { container } = render(<Markdown source={'| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo'} />)
  expect(container.querySelector('table')).not.toBeNull()
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
})
test('strips <script> and javascript: links (sanitized)', () => {
  const { container } = render(<Markdown source={'<script>alert(1)</script>\n\n[x](javascript:alert(1))'} />)
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript')
})
test('highlights a ts code block via the shared highlighter', async () => {
  const { container } = render(<Markdown source={'```ts\nconst x = 1\n```'} />)
  await waitFor(() => expect(container.querySelector('.shiki')).not.toBeNull())
  expect(container.innerHTML).toContain('--shiki-token')
})
test('link click calls onLinkClick', () => {
  const onLinkClick = vi.fn()
  render(<Markdown source="[site](https://example.com)" onLinkClick={onLinkClick} />)
  fireEvent.click(screen.getByRole('link'))
  expect(onLinkClick).toHaveBeenCalledWith('https://example.com')
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
})
