import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Placeholder } from '../src/renderer/diff/Placeholder'
import { renderWithStrings } from './helpers/i18n'

describe('Placeholder', () => {
  it('tooLarge renders the size and the limit', () => {
    renderWithStrings(<Placeholder info={{ kind: 'tooLarge', bytes: 1_258_291 }} limitBytes={1_048_576} />)
    const el = screen.getByTestId('gc-placeholder')
    expect(el).toHaveAttribute('data-kind', 'tooLarge')
    expect(el).toHaveTextContent('File too large to show (1.2 MB, limit 1 MB)')
  })

  it.each([
    ['binary', 'Binary file not shown'],
    ['unreadable', 'This file cannot be shown'],
  ] as const)('%s renders its message', (kind, text) => {
    renderWithStrings(<Placeholder info={{ kind }} limitBytes={1} />)
    expect(screen.getByTestId('gc-placeholder')).toHaveTextContent(text)
  })
})
