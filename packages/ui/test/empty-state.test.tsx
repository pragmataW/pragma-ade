import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { EmptyState } from '../src'

const TEST_ID = 'empty'

afterEach(cleanup)

test('empty state renders icon tile, title and description with fade-in under motion-safe only', () => {
  render(<EmptyState testId={TEST_ID} icon="inbox" title="Nothing here" description="Things appear here." />)
  const root = screen.getByTestId(TEST_ID)
  expect(root).toHaveTextContent('Nothing here')
  expect(root).toHaveTextContent('Things appear here.')
  expect(root.querySelector('svg')?.getAttribute('class')).toContain('lucide-inbox')
  expect(root.className).toContain('motion-safe:animate-in')
  expect(root.className).toContain('var(--motion-duration-base,160ms)')
  expect(root.className).not.toMatch(/(^|\s)animate-in/)
  expect(screen.queryByRole('button')).toBeNull()
})

test('empty state runs primary and secondary actions and shows the keyboard hint', () => {
  const primary = vi.fn()
  const secondary = vi.fn()
  render(
    <EmptyState
      icon="list-todo"
      title="No tasks"
      primaryAction={{ label: 'Create task', onClick: primary, testId: 'create' }}
      secondaryAction={{ label: 'Import', onClick: secondary }}
      hint={{ keys: ['⌘', 'N'], label: 'new task' }}
    />,
  )
  fireEvent.click(screen.getByTestId('create'))
  fireEvent.click(screen.getByRole('button', { name: 'Import' }))
  expect(primary).toHaveBeenCalledOnce()
  expect(secondary).toHaveBeenCalledOnce()
  expect(screen.getByText('⌘').tagName).toBe('KBD')
  expect(screen.getByText('new task')).toBeInTheDocument()
})

test('empty state busy spins the icon and error is exposed', () => {
  render(<EmptyState testId={TEST_ID} icon="loader-circle" title="Loading" busy error />)
  const root = screen.getByTestId(TEST_ID)
  expect(root).toHaveAttribute('aria-busy', 'true')
  expect(root).toHaveAttribute('data-error', 'true')
  expect(root.querySelector('svg')?.getAttribute('class')).toContain('motion-safe:animate-spin')
})
