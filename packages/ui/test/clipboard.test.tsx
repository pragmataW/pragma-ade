import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { CopyButton } from '../src/components/copy-button'
import { copyText } from '../src/lib/clipboard'

const stubClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('copyText uses navigator.clipboard', async () => {
  const writeText = vi.fn(async () => undefined)
  stubClipboard(writeText)
  expect(await copyText('hi')).toBe(true)
  expect(writeText).toHaveBeenCalledWith('hi')
})
test('falls back to execCommand when writeText rejects', async () => {
  stubClipboard(() => Promise.reject(new Error('denied')))
  const exec = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
  expect(await copyText('hi')).toBe(true)
  expect(exec).toHaveBeenCalledWith('copy')
})
test('CopyButton shows copied state then reverts', async () => {
  vi.useFakeTimers()
  stubClipboard(async () => undefined)
  render(<CopyButton text="x" label="Copy" copiedLabel="Copied" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
  expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTime(2000))
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
})
