import { within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { expect } from 'vitest'

/** "A very, very long message" an agent may post: many paragraphs, and one unbroken token. */
export const HUGE_TEXT = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of the report.`).join('\n')
export const HUGE_TOKEN = `https://example.com/${'a'.repeat(3000)}`

type User = ReturnType<typeof userEvent.setup>

/**
 * The box shows `text` clamped (unbroken tokens wrap), "Show more" expands it in place (scrolling inside its box
 * when `bounded`), "Show less" clamps it again.
 */
export async function expectClampToggle(box: HTMLElement, text: string, user: User, bounded: boolean) {
  const p = box.querySelector('p') as HTMLElement
  expect(p.textContent).toBe(text)
  expect(p).toHaveAttribute('data-clamped', 'true')
  expect(p).toHaveClass('overflow-hidden', 'wrap-anywhere')
  await user.click(within(box).getByRole('button', { name: 'Show more' }))
  expect(p).not.toHaveAttribute('data-clamped')
  expect(p.classList.contains('overflow-y-auto')).toBe(bounded)
  await user.click(within(box).getByRole('button', { name: 'Show less' }))
  expect(p).toHaveAttribute('data-clamped', 'true')
}
