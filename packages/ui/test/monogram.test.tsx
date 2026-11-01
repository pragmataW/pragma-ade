import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, test, vi } from 'vitest'
import { Icon } from '../src/components/icon'
import { Monogram } from '../src/components/monogram'

test('monogram renders letters from props', () => {
  const letters = 'CL'
  render(<Monogram letters={letters} />)
  expect(screen.getByText(letters)).toBeInTheDocument()
})

afterEach(() => vi.restoreAllMocks())
it.each([
  ['flask-conical', 'lucide-flask-conical', 0],
  ['git-branch', 'lucide-git-branch', 0],
  ['no-such-icon', 'lucide-circle-question-mark', 1],
])('Icon %s renders %s', (name, cls, warnings) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { container } = render(
    <>
      <Icon name={name} />
      <Icon name={name} />
    </>,
  )
  expect(container.querySelector('svg')?.getAttribute('class')).toContain(cls)
  expect(warn).toHaveBeenCalledTimes(warnings)
})
