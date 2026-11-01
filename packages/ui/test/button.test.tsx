import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Button } from '../src/components/button'

test('button renders children, merges className, uses density height var', () => {
  render(<Button className="extra">{'x'}</Button>)
  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('x')
  expect(button.className).toContain('extra')
  expect(button.className).toContain('h-[var(--control-h)]')
})
