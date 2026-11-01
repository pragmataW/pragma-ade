import { fireEvent, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BROWSER_TEST_IDS as T } from '../../src/contract'
import { BrowserSettingsPage } from '../../src/renderer/BrowserSettingsPage'
import { renderBrowser, text } from '../lib/renderer'

it('saves a valid number and ignores an invalid one', () => {
  const r = renderBrowser(<BrowserSettingsPage />)
  const input = screen.getByLabelText(text('settings.consoleErrorsInComment'))
  fireEvent.change(input, { target: { value: '5' } })
  expect(r.raw.settings.update).toHaveBeenCalledWith({ consoleErrorsInComment: 5 })
  fireEvent.change(input, { target: { value: '-4' } })
  expect(r.raw.settings.update).toHaveBeenCalledTimes(1)
  expect(input).toHaveAttribute('aria-invalid', 'true')
})

it('saves the search url on blur and toggles the react probe', () => {
  const r = renderBrowser(<BrowserSettingsPage />)
  const search = screen.getByLabelText(text('settings.searchUrl'))
  fireEvent.change(search, { target: { value: 'https://example.test/?q={query}' } })
  fireEvent.blur(search)
  fireEvent.click(screen.getByLabelText(text('settings.reactProbe')))
  expect(r.raw.settings.update).toHaveBeenCalledWith({ searchUrl: 'https://example.test/?q={query}' })
  expect(r.raw.settings.update).toHaveBeenCalledWith({ reactProbe: false })
  expect(screen.getByTestId(T.settingsPage)).toBeInTheDocument()
})
